// Provider-independent port. No remote implementation is installed.
abstract class RemoteRecords {
  String? get email;
  bool get connected;
  Future<void> restoreFor(String owner);
  Future<void> login(String email, String password);
  Future<List<Map<String, dynamic>>> history();
  Future<List<Map<String, dynamic>>> alerts();
  Future<void> disconnect();
  Future<void> dispose();
}
