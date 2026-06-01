import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:url_launcher/url_launcher.dart';

import '../update_service.dart';
import 'admin_settings_screen.dart';
import 'admin_storage.dart';
import 'github_pr_service.dart';

/// Wires up the JS-Flutter bridge and dispatches admin actions.
///
/// Actions sent by `assets/html/js/admin.js`:
///
///   { action: 'requestAdminUnlock' }
///       -> prompts the user for the admin passphrase, returns true on success.
///
///   { action: 'submitEdit', filePath, newContent, message }
///       -> commits the edit and pushes it directly onto master.
///
///   { action: 'openSettings' }
///       -> pushes AdminSettingsScreen.
class AdminBridge {
  final GlobalKey<NavigatorState> navigatorKey;
  final AdminStorage _storage = AdminStorage();

  /// Process-wide flag: once the user has unlocked admin mode in this
  /// app session, every page navigation can re-enable admin mode without
  /// asking for the passphrase again.
  ///
  /// Note: this is purely an in-memory hint to skip background WebView
  /// reloads. The "is this device an admin device" decision is the
  /// device-persistent flag stored by AdminStorage.setAdminEnabled().
  static bool _sessionUnlocked = false;

  static bool get isSessionUnlocked => _sessionUnlocked;

  /// Called when the user un-enrolls the device from Settings, so the
  /// in-memory hint matches the persistent flag.
  static void clearSessionFlag() {
    _sessionUnlocked = false;
  }

  AdminBridge({required this.navigatorKey});

  void register(InAppWebViewController controller) {
    controller.addJavaScriptHandler(
      handlerName: 'AdminBridge',
      callback: (args) async {
        try {
          final payload = (args.isNotEmpty && args[0] is Map)
              ? Map<String, dynamic>.from(args[0] as Map)
              : <String, dynamic>{};
          final action = payload['action'] as String?;
          switch (action) {
            case 'isAdminActive':
              // The page is active if the user is in the middle of an
              // admin session in THIS process AND has an active toolbar.
              // We don't auto-activate on page load just because the
              // device is registered as an admin device - the user
              // explicitly tapped X to hide the toolbar.
              return _sessionUnlocked;
            case 'clearAdminActive':
              // Hide the toolbar for now, but keep the device-level
              // admin enrolment so the next 5-tap doesn't reprompt.
              _sessionUnlocked = false;
              return true;
            case 'requestAdminUnlock':
              final ok = await _handleUnlock();
              if (ok) _sessionUnlocked = true;
              return ok;
            case 'submitEdit':
              return await _handleSubmit(payload);
            case 'openSettings':
              await _handleOpenSettings();
              return true;
            case 'openUrl':
              final url = payload['url'] as String?;
              return await _handleOpenUrl(url);
            case 'writeLocalFile':
              return await _handleWriteLocalFile(payload);
            default:
              return {'error': 'Unknown action: $action'};
          }
        } catch (e) {
          return {'error': 'Bridge error: $e'};
        }
      },
    );
  }

  // --------------- handlers ---------------

  Future<bool> _handleUnlock() async {
    final ctx = navigatorKey.currentContext;
    if (ctx == null) return false;

    // Once a device has been enrolled as an admin device (i.e. the user
    // entered the correct passphrase here at least once), subsequent
    // 5-tap bursts unlock silently with no prompt. The X button only
    // hides the toolbar; it does NOT un-enroll the device.
    final alreadyEnrolled = await _storage.isAdminEnabled();
    if (alreadyEnrolled) return true;

    final existingHash = await _storage.getPassphraseHash();
    if (existingHash == null) {
      // First time on this device: set a passphrase.
      final newPass = await _promptPassphrase(
        ctx,
        title: 'Set admin passphrase',
        body: 'No passphrase set yet. Choose one (min 6 characters).',
      );
      if (newPass == null || newPass.length < 6) return false;
      await _storage.setPassphraseHash(_hash(newPass));
      await _storage.setAdminEnabled(true);
      return true;
    }
    // Passphrase exists but device not yet enrolled (e.g. admin was
    // un-enrolled from settings, or the install was wiped). Verify.
    final pass = await _promptPassphrase(
      ctx,
      title: 'Admin unlock',
      body: 'Enter the admin passphrase to enable editing on this device.',
    );
    if (pass == null) return false;
    if (_hash(pass) != existingHash) return false;
    await _storage.setAdminEnabled(true);
    return true;
  }

  Future<Map<String, dynamic>> _handleSubmit(
      Map<String, dynamic> payload) async {
    final filePath = payload['filePath'] as String?;
    final newContent = payload['newContent'] as String?;
    final message = (payload['message'] as String?)?.trim();
    if (filePath == null || filePath.isEmpty) {
      return {'error': 'Missing filePath.'};
    }
    if (newContent == null || newContent.isEmpty) {
      return {'error': 'Missing newContent.'};
    }
    final title = (message == null || message.isEmpty)
        ? 'Edit $filePath'
        : message;

    final token = await _storage.getToken();
    if (token == null || token.isEmpty) {
      return {
        'error': 'No GitHub token saved. Open settings (gear icon) to add one.',
      };
    }
    final svc = GithubPrService(token: token);
    final result = await svc.submitEdit(
      edits: [FileEdit(filePath, newContent)],
      title: title,
    );
    if (result.success) {
      return {'url': result.url, 'commitSha': result.commitSha};
    }
    return {'error': result.error ?? 'Unknown error'};
  }

  Future<Map<String, dynamic>> _handleWriteLocalFile(
      Map<String, dynamic> payload) async {
    final filePath = payload['filePath'] as String?;
    final newContent = payload['newContent'] as String?;
    if (filePath == null || filePath.isEmpty) {
      return {'error': 'Missing filePath'};
    }
    if (newContent == null || newContent.isEmpty) {
      return {'error': 'Missing newContent'};
    }
    // filePath comes from JS as a relative HTML path under assets/html,
    // e.g. "Bereshit/1.html". UpdateService stores files in the same
    // layout under <docs>/html_content/, so we can pass it through
    // unchanged.
    final ok =
        await UpdateService.instance.writeLocalAssetFile(filePath, newContent);
    return {'ok': ok};
  }

  Future<bool> _handleOpenUrl(String? url) async {
    if (url == null || url.isEmpty) return false;
    final uri = Uri.tryParse(url);
    if (uri == null) return false;
    return launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  Future<void> _handleOpenSettings() async {
    final navigator = navigatorKey.currentState;
    if (navigator == null) return;
    await navigator.push(
      MaterialPageRoute(builder: (_) => const AdminSettingsScreen()),
    );
  }

  // --------------- helpers ---------------

  Future<String?> _promptPassphrase(
    BuildContext context, {
    required String title,
    required String body,
  }) async {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(body),
            const SizedBox(height: 8),
            TextField(
              controller: controller,
              obscureText: true,
              autofocus: true,
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                labelText: 'Passphrase',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, null),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, controller.text),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  String _hash(String s) {
    return sha256.convert(utf8.encode(s)).toString();
  }
}
