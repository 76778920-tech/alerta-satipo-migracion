import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';
import 'package:path_provider/path_provider.dart';
import '../application/mobile_service.dart';
import '../adapters/ble_receiver.dart';
import '../application/remote_records.dart';
import '../domain/measurement.dart';

class SatipoApp extends StatelessWidget {
  final MobileService service;
  final RemoteRecords? cloud;
  const SatipoApp({super.key, required this.service, this.cloud});
  @override
  Widget build(BuildContext context) => MaterialApp(
    debugShowCheckedModeBanner: false,
    title: 'Alerta Satipo',
    theme: ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xff126458)),
      scaffoldBackgroundColor: const Color(0xfff4f7f5),
      appBarTheme: const AppBarTheme(
        backgroundColor: Color(0xfff4f7f5),
        surfaceTintColor: Colors.transparent,
        centerTitle: false,
      ),
      cardTheme: CardThemeData(
        color: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        margin: const EdgeInsets.symmetric(vertical: 6),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: const BorderSide(color: Color(0xffe1e8e3)),
        ),
      ),
      navigationBarTheme: const NavigationBarThemeData(
        backgroundColor: Colors.white,
        indicatorColor: Color(0xffd6eadd),
        elevation: 0,
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size(0, 50),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
        ),
      ),
      inputDecorationTheme: const InputDecorationTheme(
        border: OutlineInputBorder(),
        filled: true,
        fillColor: Colors.white,
      ),
    ),
    home: AppShell(service: service, cloud: cloud),
  );
}

class AppShell extends StatefulWidget {
  final MobileService service;
  final RemoteRecords? cloud;
  const AppShell({super.key, required this.service, this.cloud});
  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> with WidgetsBindingObserver {
  MobileService get app => widget.service;
  final email = TextEditingController(),
      password = TextEditingController(),
      name = TextEditingController();
  final ble = BleReceiver();
  bool welcome = true;
  bool register = false, busy = false, sound = false;
  String message = '',
      filter = 'Todos',
      scenario = 'Normal',
      bleStatus = 'Sin conexión BLE';
  int tab = 0;
  List<Map<String, dynamic>> localRows = [], reports = [], users = [];
  List<Map<String, dynamic>> cloudRows = [], cloudAlerts = [];
  List<Map<String, dynamic>> get rows => cloudMode ? cloudRows : localRows;
  bool cloudMode = false, cloudBusy = false;
  String cloudStatus =
      'Vincula tu cuenta web una vez desde Perfil para ver los datos generales.';
  Timer? cloudTimer;
  int cloudGeneration = 0;
  final Map<String, String> devices = {};
  Timer? periodic, scanTimeout;
  Future<void> incoming = Future.value();
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    if (app.profile != null) {
      unawaited(
        action(() async {
          await refresh();
          await restoreCloud();
        }),
      );
    }
  }

  @override
  void dispose() {
    cloudTimer?.cancel();
    cloudGeneration++;
    if (widget.cloud != null) unawaited(widget.cloud!.dispose());
    WidgetsBinding.instance.removeObserver(this);
    periodic?.cancel();
    scanTimeout?.cancel();
    unawaited(ble.stop());
    email.dispose();
    password.dispose();
    name.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused) {
      cloudTimer?.cancel();
      periodic?.cancel();
      periodic = null;
      unawaited(ble.stop());
      bleStatus = 'Desconectado al salir de la app';
    }
    if (state == AppLifecycleState.resumed && app.profile != null) {
      unawaited(action(refresh));
      startCloudTimer();
      unawaited(refreshCloud());
    }
  }

  Future<void> refresh() async {
    localRows = await app.history();
    reports = await app.records.reports(app.profile!['usuario_id']);
    users = app.isAdmin ? await app.listUsers() : [];
  }

  void startCloudTimer() {
    cloudTimer?.cancel();
    if (widget.cloud?.connected == true) {
      cloudTimer = Timer.periodic(
        const Duration(seconds: 15),
        (_) => refreshCloud(),
      );
    }
  }

  Future<void> restoreCloud() async {
    if (widget.cloud == null || app.profile == null) return;
    try {
      await widget.cloud!.restoreFor(app.profile!['usuario_id']);
      if (widget.cloud!.connected) {
        cloudMode = true;
        cloudStatus = 'Consultando datos generales automáticamente…';
        startCloudTimer();
        await refreshCloud();
      }
    } catch (_) {
      cloudStatus =
          'No se pudo recuperar la cuenta web. Revisa la vinculación en Perfil.';
    }
  }

  Future<void> refreshCloud() async {
    final cloud = widget.cloud;
    if (cloud == null || !cloud.connected || cloudBusy || app.profile == null) {
      return;
    }
    final generation = cloudGeneration;
    setState(() => cloudBusy = true);
    try {
      await app.authorize();
      final data = await cloud.history().timeout(const Duration(seconds: 20));
      final alerts = await cloud.alerts().timeout(const Duration(seconds: 20));
      if (!mounted || generation != cloudGeneration) return;
      setState(() {
        cloudRows = data;
        cloudAlerts = alerts;
        cloudStatus =
            'Datos generales: ${data.length} lecturas y ${alerts.length} alertas. '
            'Consulta: ${DateTime.now().toLocal().toString().substring(0, 19)}. Actualización cada 15 s.';
      });
    } catch (_) {
      if (!mounted || generation != cloudGeneration) return;
      setState(() {
        cloudRows = [];
        cloudAlerts = [];
        cloudStatus = cloud.connected
            ? 'Sin datos generales actualizados. Reintentaremos automáticamente al recuperar la conexión. Puedes consultar tus lecturas locales.'
            : 'La sesión web terminó. Vuelve a vincular tu cuenta desde Perfil.';
      });
    } finally {
      if (mounted) setState(() => cloudBusy = false);
    }
  }

  Future<void> connectCloud() async {
    final cloud = widget.cloud;
    if (cloud == null) return;
    final mail = TextEditingController(), secret = TextEditingController();
    final credentials = await showDialog<List<String>>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Vincular cuenta web'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Text(
                'Ingresa tu cuenta web autorizada. Su sesión se guardará de forma segura para conectar automáticamente cuando haya internet. La contraseña no se guarda.',
              ),
              const SizedBox(height: 16),
              TextField(
                controller: mail,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(
                  labelText: 'Correo de la web',
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: secret,
                obscureText: true,
                enableSuggestions: false,
                autocorrect: false,
                decoration: const InputDecoration(
                  labelText: 'Contraseña de la web',
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, [mail.text, secret.text]),
            child: const Text('Conectar'),
          ),
        ],
      ),
    );
    // Dispose after the closing dialog transition has released its fields.
    await Future<void>.delayed(const Duration(milliseconds: 300));
    mail.dispose();
    secret.dispose();
    if (credentials == null || !mounted) return;
    cloudGeneration++;
    cloudRows = [];
    cloudAlerts = [];
    try {
      await cloud.login(credentials[0], credentials[1]);
      if (!mounted) return;
      setState(() {
        cloudMode = true;
        filter = 'Todos';
      });
      await refreshCloud();
      startCloudTimer();
    } catch (_) {
      throw StateError(
        'No se pudo conectar. Usa una cuenta de poblador autorizada. Las cuentas administradoras acceden al panel web.',
      );
    }
  }

  List<Widget> cloudControls({bool account = false}) => [
    if (account)
      notice(cloudStatus)
    else
      Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: Row(
          children: [
            Icon(
              cloudMode ? Icons.cloud_outlined : Icons.phone_android,
              size: 17,
              color: const Color(0xff52665b),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                cloudMode
                    ? 'Consulta general · actualización automática'
                    : 'Datos guardados en este teléfono',
                style: const TextStyle(fontSize: 12, color: Color(0xff52665b)),
              ),
            ),
            IconButton(
              tooltip: cloudStatus,
              onPressed: () => showDialog<void>(
                context: context,
                builder: (context) => AlertDialog(
                  title: const Text('Estado de conexión'),
                  content: Text(cloudStatus),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('Cerrar'),
                    ),
                  ],
                ),
              ),
              icon: const Icon(Icons.info_outline, size: 19),
            ),
          ],
        ),
      ),
    if (widget.cloud != null && widget.cloud!.connected) ...[
      if (account) Text('Cuenta web: ${widget.cloud!.email}'),
      if (!account)
        SegmentedButton<bool>(
          segments: [
            ButtonSegment(
              value: false,
              label: Text(tab == 1 ? 'Tus alertas' : 'Tus lecturas'),
            ),
            ButtonSegment(
              value: true,
              label: Text(
                tab == 1 ? 'Alertas generales' : 'Lecturas generales',
              ),
            ),
          ],
          selected: {cloudMode},
          onSelectionChanged: (v) => setState(() => cloudMode = v.single),
        ),
      if (cloudBusy) const LinearProgressIndicator(),
      if (account)
        button('Desconectar cuenta web', () async {
          cloudGeneration++;
          cloudTimer?.cancel();
          cloudRows = [];
          cloudAlerts = [];
          cloudMode = false;
          cloudStatus =
              'Cuenta web desvinculada. Puedes vincularla de nuevo desde Perfil.';
          await widget.cloud!.disconnect();
        }, icon: Icons.link_off),
    ] else if (account && widget.cloud != null)
      button('Vincular cuenta web', connectCloud, icon: Icons.cloud_outlined),
  ];

  Future<void> action(Future<void> Function() fn) async {
    if (busy) return;
    setState(() => busy = true);
    try {
      await fn();
    } catch (e) {
      message = e is FormatException
          ? e.message
          : e is StateError
          ? e.message
          : 'No se pudo completar la operación. Revisa los datos y permisos.';
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> logout() async {
    cloudGeneration++;
    cloudTimer?.cancel();
    cloudRows = [];
    cloudAlerts = [];
    cloudMode = false;
    if (widget.cloud != null) await widget.cloud!.disconnect();
    cloudStatus =
        'Vincula tu cuenta web desde Perfil para ver los datos generales.';
    periodic?.cancel();
    periodic = null;
    scanTimeout?.cancel();
    await ble.stop();
    await app.logout();
    localRows = [];
    reports = [];
    users = [];
    devices.clear();
    password.clear();
    tab = 0;
    message = 'Sesión cerrada.';
  }

  Color color(String level) => level == 'Normal'
      ? const Color(0xff126458)
      : level == 'Advertencia'
      ? const Color(0xff8a5700)
      : const Color(0xffae2630);
  Widget heading(String title, String detail) => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.headlineMedium?.copyWith(
            fontWeight: FontWeight.w800,
            letterSpacing: -0.7,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          detail,
          style: const TextStyle(color: Color(0xff52665b), height: 1.45),
        ),
      ],
    ),
  );
  Widget notice(String text) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.info_outline, size: 19, color: Color(0xff52665b)),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(height: 1.45, color: Color(0xff52665b)),
            ),
          ),
        ],
      ),
    ),
  );
  Widget button(
    String label,
    Future<void> Function() run, {
    IconData icon = Icons.arrow_forward,
  }) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 4),
    child: FilledButton.tonalIcon(
      onPressed: busy ? null : () => action(run),
      icon: Icon(icon),
      label: Text(label),
    ),
  );
  @override
  Widget build(BuildContext context) {
    if (welcome) return introduction();
    final logged = app.profile != null;
    return Scaffold(
      appBar: AppBar(
        title: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.forest_rounded, color: Color(0xff126458)),
            SizedBox(width: 9),
            Text(
              'Alerta Satipo',
              style: TextStyle(fontSize: 19, fontWeight: FontWeight.w700),
            ),
          ],
        ),
        actions: logged
            ? [
                IconButton(
                  tooltip: 'Mi perfil',
                  onPressed: () => setState(() => tab = 4),
                  icon: const Icon(Icons.account_circle_outlined),
                ),
              ]
            : null,
      ),
      body: SafeArea(
        child: Column(
          children: [
            if (busy) const LinearProgressIndicator(),
            if (message.isNotEmpty)
              MaterialBanner(
                content: Text(message),
                actions: [
                  TextButton(
                    onPressed: () => setState(() => message = ''),
                    child: const Text('Cerrar'),
                  ),
                ],
              ),
            Expanded(
              child: logged
                  ? ListView(
                      key: ValueKey(tab),
                      padding: const EdgeInsets.all(20),
                      children: content(),
                    )
                  : login(),
            ),
          ],
        ),
      ),
      bottomNavigationBar: logged
          ? NavigationBar(
              selectedIndex: tab,
              onDestinationSelected: (v) => setState(() => tab = v),
              destinations: const [
                NavigationDestination(
                  icon: Icon(Icons.shield_outlined),
                  label: 'Estado',
                ),
                NavigationDestination(
                  icon: Icon(Icons.notifications_outlined),
                  label: 'Alertas',
                ),
                NavigationDestination(
                  icon: Icon(Icons.history),
                  label: 'Historial',
                ),
                NavigationDestination(
                  icon: Icon(Icons.bluetooth),
                  label: 'Dispositivo',
                ),
                NavigationDestination(
                  icon: Icon(Icons.person_outline),
                  label: 'Perfil',
                ),
              ],
            )
          : null,
    );
  }

  Widget introduction() => Scaffold(
    backgroundColor: const Color(0xff103e35),
    body: SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(28),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Row(
                  children: [
                    Icon(
                      Icons.forest_rounded,
                      color: Color(0xffbce8bd),
                      size: 32,
                    ),
                    SizedBox(width: 12),
                    Text(
                      'ALERTA SATIPO',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 2,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 44),
                const Center(
                  child: CircleAvatar(
                    radius: 64,
                    backgroundColor: Color(0xff24574b),
                    child: Icon(
                      Icons.shield_outlined,
                      size: 72,
                      color: Color(0xffbce8bd),
                    ),
                  ),
                ),
                const SizedBox(height: 32),
                const Text(
                  'Conoce tu entorno.\nCuida tu comunidad.',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 34,
                    height: 1.15,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Monitoreo ambiental y alertas de posibles incendios para Satipo.',
                  style: TextStyle(
                    color: Color(0xffd2e5dc),
                    fontSize: 17,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 24),
                introFeature(
                  Icons.sensors,
                  'Monitorea tu entorno',
                  'Consulta temperatura, humedad, humo, gas y polvo.',
                ),
                introFeature(
                  Icons.notifications_active_outlined,
                  'Reconoce el nivel de alerta',
                  'Normal, Advertencia y Emergencia, con color y texto.',
                ),
                introFeature(
                  Icons.history,
                  'Conserva tu historial',
                  'Revisa en tu teléfono las lecturas guardadas, incluso sin internet.',
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xffc4edb3),
                      foregroundColor: const Color(0xff103e35),
                      padding: const EdgeInsets.symmetric(vertical: 18),
                    ),
                    onPressed: () => setState(() => welcome = false),
                    icon: const Icon(Icons.arrow_forward),
                    label: const Text(
                      'Comenzar',
                      style: TextStyle(fontSize: 17),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Inicia sesión o crea una cuenta para acceder.',
                  style: TextStyle(color: Color(0xffd2e5dc)),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );

  Widget introFeature(IconData icon, String title, String detail) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 10),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, color: const Color(0xffbce8bd)),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                detail,
                style: const TextStyle(color: Color(0xffd2e5dc), height: 1.4),
              ),
            ],
          ),
        ),
      ],
    ),
  );

  Widget login() => ListView(
    padding: const EdgeInsets.all(24),
    children: [
      const SizedBox(height: 24),
      const Icon(Icons.forest, size: 64, color: Color(0xff126458)),
      const SizedBox(height: 20),
      heading(
        register ? 'Crear cuenta local' : 'Iniciar sesión',
        'Monitoreo, alertas e historial disponibles en este teléfono.',
      ),
      if (register) ...[
        TextField(
          controller: name,
          decoration: const InputDecoration(labelText: 'Nombre completo'),
        ),
        const SizedBox(height: 16),
      ],
      TextField(
        controller: email,
        keyboardType: TextInputType.emailAddress,
        decoration: const InputDecoration(labelText: 'Correo electrónico'),
      ),
      const SizedBox(height: 16),
      TextField(
        controller: password,
        obscureText: true,
        decoration: const InputDecoration(
          labelText: 'Contraseña',
          helperText: 'Para registro: mínimo 12 caracteres',
        ),
      ),
      const SizedBox(height: 16),
      button(register ? 'Crear cuenta' : 'Ingresar', () async {
        if (register) {
          await app.register(name.text, email.text, password.text);
          register = false;
          password.clear();
          message = 'Cuenta creada. Ya puedes iniciar sesión.';
        } else {
          await app.login(email.text, password.text);
          password.clear();
          message = '';
          await refresh();
          await restoreCloud();
        }
      }),
      TextButton(
        onPressed: busy ? null : () => setState(() => register = !register),
        child: Text(register ? 'Ya tengo cuenta' : 'Crear una cuenta'),
      ),
      notice(
        'Cuentas locales: no son las del panel web. Todas las cuentas de esta app son de pobladores. No concede permisos en servicio remoto.',
      ),
      notice(
        'Prototipo experimental. Las lecturas simuladas se identifican; el modelo no está validado con incendios reales.',
      ),
    ],
  );
  List<Widget> content() {
    switch (tab) {
      case 0:
        return home();
      case 1:
        return alerts();
      case 2:
        return history();
      case 3:
        return device();
      default:
        return profile();
    }
  }

  List<Widget> home() {
    final last = rows.isEmpty ? null : rows.first;
    return [
      heading(
        'Estado actual',
        last == null
            ? 'Sin mediciones disponibles.'
            : cloudMode
            ? 'Última lectura recibida de servicio remoto.'
            : 'Última lectura conservada en este teléfono.',
      ),
      ...cloudControls(),
      if (last == null)
        notice(
          cloudMode
              ? 'Sin lecturas remotas disponibles. Revisa el estado de conexión.'
              : 'Todavía no hay lecturas locales. Puedes conectar un dispositivo compatible por Bluetooth.',
        )
      else ...[
        Card(
          color: color(last['prediction']['level']),
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  last['prediction']['level'],
                  style: const TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                Text(
                  last['reading']['source'] == 'simulation'
                      ? 'SIMULACIÓN · no es una medición real'
                      : 'SENSOR · evaluación experimental',
                  style: const TextStyle(color: Colors.white),
                ),
                const SizedBox(height: 8),
                Text(
                  displayDate(last['reading']['observed_at']),
                  style: const TextStyle(color: Colors.white),
                ),
              ],
            ),
          ),
        ),
        ...measurementTiles(last),
        ExpansionTile(
          title: const Text('Detalles del an\u00e1lisis'),
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Text(
                'Modelo: ${last['prediction']['model_version']}. Resultado experimental. Los datos simulados no confirman un incendio real.',
              ),
            ),
          ],
        ),
      ],
      button('Reportar una observación', reportDialog, icon: Icons.edit_note),
      notice(
        'Los reportes se conservan localmente. Esta versión no envía solicitudes de ayuda ni llama a servicios de emergencia.',
      ),
      notice(
        'La consulta funciona sin Internet. BLE recibe con la app abierta; se detiene en segundo plano. La fecha identifica la antigüedad de la lectura.',
      ),
    ];
  }

  String displayDate(String raw) {
    final date = DateTime.tryParse(raw)?.toLocal();
    if (date == null) return raw;
    String two(int n) => n.toString().padLeft(2, '0');
    return '${two(date.day)}/${two(date.month)}/${date.year} \u00b7 ${two(date.hour)}:${two(date.minute)}';
  }

  IconData levelIcon(String level) => level == 'Normal'
      ? Icons.verified_outlined
      : level == 'Advertencia'
      ? Icons.warning_amber_rounded
      : Icons.notification_important_outlined;

  List<Widget> measurementTiles(Map<String, dynamic> row) => [
    const SizedBox(height: 12),
    LayoutBuilder(
      builder: (context, constraints) {
        const labels = [
          'Temperatura',
          'Humedad',
          'Humo',
          'Gas',
          'Part\u00edculas PM2.5',
        ];
        const units = ['\u00b0C', '%', '\u00edndice 0-100', '\u00edndice 0-100', '\u00b5g/m\u00b3'];
        const icons = [
          Icons.thermostat,
          Icons.water_drop_outlined,
          Icons.air,
          Icons.bubble_chart_outlined,
          Icons.grain,
        ];
        final columns =
            constraints.maxWidth >= 320 &&
                MediaQuery.textScalerOf(context).scale(1) < 1.5
            ? 2
            : 1;
        return Wrap(
          spacing: 12,
          runSpacing: 12,
          children: List.generate(
            5,
            (i) => SizedBox(
              width: (constraints.maxWidth - (columns - 1) * 12) / columns,
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: const Color(0xffe1e8e3)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(icons[i], color: const Color(0xff126458), size: 23),
                    const SizedBox(height: 12),
                    Text(
                      labels[i],
                      style: const TextStyle(
                        color: Color(0xff52665b),
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      (row['reading']['values'][features[i]] as num)
                          .toStringAsFixed(1),
                      style: const TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w700,
                        color: Color(0xff163e32),
                      ),
                    ),
                    Text(
                      units[i],
                      style: const TextStyle(
                        color: Color(0xff52665b),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    ),
    const SizedBox(height: 12),
  ];

  List<Widget> alerts() {
    final list = (cloudMode ? cloudAlerts : localRows)
        .where(
          (r) =>
              r['prediction']['level'] != 'Normal' &&
              (filter == 'Todos' || r['prediction']['level'] == filter),
        )
        .toList();
    return [
      heading(
        'Alertas',
        cloudMode
            ? 'Alertas generales que tu cuenta tiene permiso de consultar. Se muestran las 200 más recientes.'
            : 'Tus alertas guardadas en este teléfono, compartidas por las cuentas locales de esta instalación.',
      ),
      ...cloudControls(),
      const SizedBox(height: 16),
      levelFilter(),
      const SizedBox(height: 12),
      if (list.isEmpty)
        notice(
          cloudMode
              ? 'No hay alertas remotas disponibles para este filtro. Revisa el estado de la consulta.'
              : 'No hay alertas locales para este filtro. Conecta servicio remoto para consultar las del servidor.',
        ),
      ...list.take(200).map((r) => readingCard(r, alert: true)),
    ];
  }

  Widget levelFilter() => DropdownButtonFormField<String>(
    initialValue: filter,
    decoration: const InputDecoration(labelText: 'Filtrar por nivel'),
    items: [
      'Todos',
      ...levels,
    ].map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(),
    onChanged: (v) => setState(() => filter = v!),
  );
  List<Widget> history() {
    final list = rows
        .where((r) => filter == 'Todos' || r['prediction']['level'] == filter)
        .toList();
    return [
      heading(
        'Historial',
        '${rows.length} lecturas completas · ${cloudMode ? 'servicio remoto (hasta 1000)' : 'SQLite local'}',
      ),
      ...cloudControls(),
      const SizedBox(height: 16),
      levelFilter(),
      const SizedBox(height: 12),
      if (app.canOperate && !cloudMode)
        button('Exportar historial JSON', () async {
          final json = await app.export();
          final directory = await getTemporaryDirectory();
          final file = File(
            '${directory.path}/satipo-${DateTime.now().millisecondsSinceEpoch}.json',
          );
          await file.writeAsString(json);
          await SharePlus.instance.share(
            ShareParams(
              files: [XFile(file.path)],
              text: 'Registros experimentales Alerta Satipo',
            ),
          );
        }, icon: Icons.ios_share),
      if (list.isEmpty)
        notice(
          'No hay registros. No se requiere Internet para consultar datos guardados.',
        ),
      if (list.length > 200)
        notice(
          'Se muestran los 200 más recientes. La exportación incluye todos.',
        ),
      ...list.take(200).map((r) => readingCard(r)),
    ];
  }

  Widget readingCard(Map<String, dynamic> r, {bool alert = false}) => Card(
    child: ExpansionTile(
      tilePadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      leading: CircleAvatar(
        backgroundColor: color(r['prediction']['level']).withValues(alpha: 0.1),
        child: Icon(
          levelIcon(r['prediction']['level']),
          color: color(r['prediction']['level']),
        ),
      ),
      title: Text(
        r['prediction']['level'],
        style: TextStyle(
          color: color(r['prediction']['level']),
          fontWeight: FontWeight.bold,
        ),
      ),
      subtitle: Text(
        '${r['reading']['source'] == 'simulation' ? 'SIMULACIÓN' : 'SENSOR'} · ${displayDate(r['reading']['observed_at'])}',
      ),
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ...measurementTiles(r),
              if (alert) ...[
                Text('Atención: ${r['attention']}'),
                if (app.isAdmin && r['synced'] != true)
                  Wrap(
                    spacing: 8,
                    children: ['ATENDIDO', 'DESCARTADO', 'PENDIENTE']
                        .map(
                          (status) => button(status, () async {
                            await app.attend(r['reading']['id'], status);
                            await refresh();
                          }),
                        )
                        .toList(),
                  ),
              ],
            ],
          ),
        ),
      ],
    ),
  );
  List<Widget> device() => [
    heading('Dispositivo', bleStatus),
    if (!app.canOperate)
      notice('Inicia sesión como poblador para recibir mediciones.')
    else ...[
      button('Buscar nodos BLE compatibles', () async {
        await app.authorize(operation: true);
        devices.clear();
        await ble.scan(
          (d) {
            if (mounted) {
              setState(() => devices[d.id] = d.name.isEmpty ? d.id : d.name);
            }
          },
          (_) {
            if (mounted) {
              setState(
                () => bleStatus = 'Bluetooth no disponible o sin permisos.',
              );
            }
          },
        );
        bleStatus = 'Buscando durante 12 segundos…';
        scanTimeout?.cancel();
        scanTimeout = Timer(const Duration(seconds: 12), () {
          ble.scanSubscription?.cancel();
          if (mounted) {
            setState(
              () => bleStatus = 'Búsqueda finalizada: ${devices.length} nodos.',
            );
          }
        });
      }, icon: Icons.bluetooth_searching),
      ...devices.entries.map(
        (d) => button('Conectar: ${d.value}', () async {
          scanTimeout?.cancel();
          await app.authorize(operation: true);
          await ble.connect(
            d.key,
            (raw) {
              incoming = incoming
                  .then((_) async {
                    if (app.profile == null) return;
                    if (raw['observed_at'] == null) {
                      raw = {
                        ...raw,
                        'observed_at': DateTime.now().toUtc().toIso8601String(),
                      };
                    }
                    await app.ingest([raw]);
                    await refresh();
                    if (sound &&
                        localRows.isNotEmpty &&
                        localRows.first['prediction']['level'] ==
                            'Emergencia') {
                      await const MethodChannel(
                        'satipo/alerts',
                      ).invokeMethod<void>('emergencyTone');
                    }
                    if (mounted) {
                      setState(
                        () => bleStatus = 'Lectura recibida y guardada.',
                      );
                    }
                  })
                  .catchError((Object error) {
                    if (mounted) {
                      setState(
                        () => bleStatus =
                            'Lectura rechazada: comprueba sesión, modelo y formato.',
                      );
                    }
                  });
            },
            (status) {
              if (mounted) setState(() => bleStatus = status);
            },
          );
        }),
      ),
      button('Desconectar BLE', () async {
        await ble.stop();
        bleStatus = 'Desconectado';
      }),
      notice(
        'Requiere firmware con el servicio BLE Satipo. Sin reloj UTC en el nodo, se registra la hora de recepción. Prueba física pendiente.',
      ),
    ],
  ];
  List<Widget> profile() => [
    heading(app.profile!['nombre'], '${app.profile!['correo']} · ${app.role}'),
    ...cloudControls(account: true),
    notice(
      'Cuenta local. La telemetría se comparte en esta instalación; tus reportes son personales. Sesión válida por 24 horas.',
    ),
    SwitchListTile(
      title: const Text('Sonido de emergencia en primer plano'),
      subtitle: const Text(
        'Depende del volumen de Android. No funciona en segundo plano.',
      ),
      value: sound,
      onChanged: (v) => setState(() => sound = v),
    ),
    const Text(
      'Mis reportes',
      style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
    ),
    if (reports.isEmpty) notice('No has registrado observaciones.'),
    ...reports.map(
      (r) => ListTile(
        title: Text(r['location']),
        subtitle: Text('${r['description']}\nGuardado local · no enviado'),
      ),
    ),
    button('Cerrar sesión', logout, icon: Icons.logout),
  ];
  Future<void> reportDialog() async {
    final controllers = List.generate(7, (_) => TextEditingController());
    const labels = [
      'Lugar *',
      'Observación *',
      'Gravedad observada *',
      'Descripción *',
      'Contacto opcional',
      'Distancia aproximada',
      'Referencia del lugar',
    ];
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Reportar observación'),
        content: SizedBox(
          width: 420,
          child: SingleChildScrollView(
            child: Column(
              children: List.generate(
                7,
                (i) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: TextField(
                    controller: controllers[i],
                    maxLength: i == 3 ? 2000 : 160,
                    decoration: InputDecoration(labelText: labels[i]),
                  ),
                ),
              ),
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancelar'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Guardar localmente'),
          ),
        ],
      ),
    );
    try {
      if (confirmed == true) {
        await app.report(
          Map.fromIterables([
            'location',
            'type',
            'severity',
            'description',
            'contact',
            'distance',
            'reference',
          ], controllers.map((c) => c.text.trim())),
        );
        await refresh();
        message = 'Observación guardada; no enviada.';
      }
    } finally {
      for (final c in controllers) {
        c.dispose();
      }
    }
  }
}
