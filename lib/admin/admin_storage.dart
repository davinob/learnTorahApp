import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Thin wrapper around flutter_secure_storage for the admin feature.
///
/// Stores three secrets:
///   - github_token: the fine-grained PAT
///   - admin_passphrase_hash: SHA-256 of the unlock passphrase (set first time)
///   - admin_enabled: '1' once the user has unlocked admin mode at least once
class AdminStorage {
  static const _kToken = 'admin_github_token';
  static const _kPassHash = 'admin_passphrase_hash';
  static const _kEnabled = 'admin_enabled';

  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  Future<String?> getToken() => _storage.read(key: _kToken);
  Future<void> setToken(String token) =>
      _storage.write(key: _kToken, value: token);
  Future<void> clearToken() => _storage.delete(key: _kToken);

  Future<String?> getPassphraseHash() => _storage.read(key: _kPassHash);
  Future<void> setPassphraseHash(String hash) =>
      _storage.write(key: _kPassHash, value: hash);

  Future<bool> isAdminEnabled() async =>
      (await _storage.read(key: _kEnabled)) == '1';
  Future<void> setAdminEnabled(bool enabled) async {
    if (enabled) {
      await _storage.write(key: _kEnabled, value: '1');
    } else {
      await _storage.delete(key: _kEnabled);
    }
  }
}
