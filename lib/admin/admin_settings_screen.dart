import 'package:flutter/material.dart';

import '../update_service.dart';
import 'admin_bridge.dart';
import 'admin_storage.dart';
import 'github_pr_service.dart';

class AdminSettingsScreen extends StatefulWidget {
  const AdminSettingsScreen({super.key});

  @override
  State<AdminSettingsScreen> createState() => _AdminSettingsScreenState();
}

class _AdminSettingsScreenState extends State<AdminSettingsScreen> {
  final _storage = AdminStorage();
  final _tokenController = TextEditingController();
  bool _loading = true;
  String? _statusMessage;
  bool _statusOk = false;
  bool _hasToken = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final token = await _storage.getToken();
    if (!mounted) return;
    setState(() {
      _hasToken = token != null && token.isNotEmpty;
      _loading = false;
    });
  }

  Future<void> _save() async {
    final token = _tokenController.text.trim();
    if (token.isEmpty) {
      setState(() {
        _statusOk = false;
        _statusMessage = 'Token is empty.';
      });
      return;
    }
    await _storage.setToken(token);
    _tokenController.clear();
    if (!mounted) return;
    setState(() {
      _hasToken = true;
      _statusOk = true;
      _statusMessage = 'Token saved.';
    });
  }

  Future<void> _test() async {
    final token = await _storage.getToken();
    if (token == null || token.isEmpty) {
      setState(() {
        _statusOk = false;
        _statusMessage = 'No token saved yet.';
      });
      return;
    }
    setState(() {
      _statusMessage = 'Testing...';
      _statusOk = false;
    });
    final svc = GithubPrService(token: token);
    final err = await svc.verifyToken();
    if (!mounted) return;
    setState(() {
      if (err == null) {
        _statusOk = true;
        _statusMessage =
            'OK. Token has access to ${UpdateConfig.owner}/${UpdateConfig.repo}.';
      } else {
        _statusOk = false;
        _statusMessage = err;
      }
    });
  }

  Future<void> _signOut() async {
    await _storage.clearToken();
    if (!mounted) return;
    setState(() {
      _hasToken = false;
      _statusOk = true;
      _statusMessage = 'Token cleared.';
    });
  }

  Future<void> _disableAdmin() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Disable admin mode?'),
        content: const Text(
            'You will need the passphrase again to re-enable admin mode.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Disable')),
        ],
      ),
    );
    if (confirmed != true) return;
    await _storage.setAdminEnabled(false);
    AdminBridge.clearSessionFlag();
    if (!mounted) return;
    Navigator.pop(context, 'admin-disabled');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Admin settings'),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'GitHub repo',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 4),
                        SelectableText(
                            '${UpdateConfig.owner}/${UpdateConfig.repo} (${UpdateConfig.branch})'),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  'Fine-grained personal access token',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 4),
                Text(
                  _hasToken
                      ? 'A token is currently saved. Paste a new one below to replace it.'
                      : 'No token saved. Paste a token to enable pushing edits.',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _tokenController,
                  obscureText: true,
                  decoration: const InputDecoration(
                    border: OutlineInputBorder(),
                    labelText: 'github_pat_...',
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    FilledButton.icon(
                      onPressed: _save,
                      icon: const Icon(Icons.save),
                      label: const Text('Save'),
                    ),
                    const SizedBox(width: 8),
                    OutlinedButton.icon(
                      onPressed: _test,
                      icon: const Icon(Icons.network_check),
                      label: const Text('Test token'),
                    ),
                    const SizedBox(width: 8),
                    if (_hasToken)
                      TextButton.icon(
                        onPressed: _signOut,
                        icon: const Icon(Icons.logout),
                        label: const Text('Sign out'),
                      ),
                  ],
                ),
                if (_statusMessage != null) ...[
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: _statusOk
                          ? Colors.green.withValues(alpha: 0.15)
                          : Colors.red.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(_statusMessage!),
                  ),
                ],
                const SizedBox(height: 32),
                const Divider(),
                const SizedBox(height: 16),
                OutlinedButton.icon(
                  onPressed: _disableAdmin,
                  icon: const Icon(Icons.lock),
                  label: const Text('Exit admin mode'),
                ),
                const SizedBox(height: 24),
                Text(
                  'Required token scopes (fine-grained):',
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                const SizedBox(height: 4),
                const Text(
                  '  - Contents: Read and write\n'
                  '  - Metadata: Read-only\n\n'
                  'Restrict the token to ONLY this repo. The token must be allowed to push '
                  'directly to master (admin/owner role, or master is not branch-protected).',
                ),
              ],
            ),
    );
  }

  @override
  void dispose() {
    _tokenController.dispose();
    super.dispose();
  }
}
