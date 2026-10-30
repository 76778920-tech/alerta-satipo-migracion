import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:uuid/uuid.dart';
import 'adapters/local_database.dart';
import 'adapters/security.dart';
import 'application/mobile_service.dart';
import 'domain/measurement.dart';
import 'ui/app.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(Bootstrap(initialization: initialize()));
}

Future<SatipoApp> initialize() async {
  final db = await LocalDatabase.open();
  final model = LocalModel(
    jsonDecode(await rootBundle.loadString('assets/pmv1-model.json')),
  );
  final app = MobileService(
    records: db,
    users: db,
    session: SecureSession(),
    passwords: PasswordHasher(),
    model: model,
    now: DateTime.now,
    uuid: const Uuid().v4,
  );
  // Require login on each cold launch; retain accounts and measurements.
  await app.logout();
  // Migration copy: local storage only, no remote client initialized.
  return SatipoApp(service: app);
}

class Bootstrap extends StatelessWidget {
  final Future<SatipoApp> initialization;
  const Bootstrap({super.key, required this.initialization});

  @override
  Widget build(BuildContext context) => FutureBuilder<SatipoApp>(
    future: initialization,
    builder: (context, snapshot) {
      if (snapshot.hasData) return snapshot.data!;
      return MaterialApp(
        debugShowCheckedModeBanner: false,
        home: Scaffold(
          backgroundColor: const Color(0xff103e35),
          body: SafeArea(
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(28),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.forest_rounded,
                      size: 80,
                      color: Color(0xffc4edb3),
                    ),
                    const SizedBox(height: 24),
                    const Text(
                      'Alerta Satipo',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 24),
                    if (!snapshot.hasError)
                      const CircularProgressIndicator(color: Color(0xffc4edb3)),
                    const SizedBox(height: 20),
                    Text(
                      snapshot.hasError
                          ? 'No se pudo abrir el almacenamiento. Cierra y vuelve a abrir la app. Tus datos se conservan.'
                          : 'Preparando tu espacio de monitoreo...',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.white),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
    },
  );
}
