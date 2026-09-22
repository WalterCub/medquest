# MedQuest — v0.1 (vertical slice)

Juego de decisiones clínicas para preparar el examen de grado de medicina en
Bolivia. Herramienta educativa: no diagnostica, no atiende pacientes y no
sustituye el criterio médico ni la bibliografía oficial.

El ciclo completo está funcionando:

```
PACIENTE → INVESTIGAR → DECIDIR → CERRAR CASO → TRIBUNAL → EVALUACIÓN → RECOMPENSA
```

---

## Cómo se corre

**Para desarrollar** (los ES Modules necesitan http, no abren con doble clic):

```bash
cd medquest
python3 -m http.server 8080
# abrir http://localhost:8080
```

**Publicado en GitHub Pages:** https://waltercub.github.io/medquest/

**Para publicar un cambio**, desde esta carpeta:

```bash
node tools/publicar.mjs
```

Corre la validación de casos y citas, el smoke test y el build; si todo pasa,
sube el sitio a la rama `gh-pages` y GitHub Pages lo publica en uno o dos
minutos. Si algo falla, no publica nada y queda en línea la versión anterior.
Aparte, hacer `git commit` y `git push` para guardar el código en `main`.

*Publicación automática (pendiente).* Existe `.github/workflows/pages.yml`, que
hace lo mismo en cada `git push`, pero GitHub Actions está bloqueado en la
cuenta por un problema de facturación y el workflow quedó desactivado. Cuando
se resuelva (GitHub → Settings → Billing and plans):

```bash
gh workflow enable pages.yml
```

y en el repositorio, Settings → Pages → Source: *GitHub Actions*.

**Instalarlo en el iPhone:** abrir el enlace en Safari → Compartir → *Agregar a
pantalla de inicio*. Queda como app, funciona sin conexión y es menos probable
que iOS borre el progreso.

**Archivo único** (para mandarlo por otro medio; se publica también en
`/medquest.html`):

```bash
node tools/build.mjs      # → dist/medquest.html
```

Los PDFs de las normas no están en el repositorio (pesan ~70 MB). Se bajan de
minsalud.gob.bo (enlaces en `preguntas/fuentes.json` y en cada caso) a
`fuentes/nnac/` y `fuentes/caracterizacion/`. El texto ya extraído sí está en
`fuentes/texto/`, así que la validación funciona sin los PDFs.

**Validar los casos y el banco de preguntas** (comprueba que cada cita del banco
esté, textual, en la página indicada del PDF):

```bash
node tools/validate.mjs
```

Si se agrega un PDF nuevo al catálogo `preguntas/fuentes.json`, antes hay que
extraer su texto (necesita `pdftotext`, que viene con Git para Windows):

```bash
node tools/extraer-texto.mjs
```

**Probar los motores sin navegador** (juega dos partidas completas y comprueba
invariantes):

```bash
node tools/smoke.mjs
```

---

## Qué hay

```
medquest/
├── index.html
├── css/game.css
├── js/
│   ├── app.js                      cableado; tiene el estado de sesión
│   ├── engine/
│   │   ├── caseEngine.js           estado de partida, descubrimiento, DecisionLog
│   │   ├── tribunalEngine.js       selección determinista de preguntas
│   │   ├── scoringEngine.js        rúbrica → 6 dimensiones + conceptos a repasar
│   │   ├── learningEngine.js       selección ponderada, temas débiles, perfil
│   │   ├── rewardEngine.js         Kamas, racha, misiones
│   │   └── quizEngine.js           rondas del banco de preguntas, repetición de lo fallado
│   ├── services/
│   │   ├── storage.js              única puerta de datos persistentes
│   │   ├── caseRepository.js       de dónde salen los casos
│   │   └── bancoRepository.js      de dónde salen las preguntas
│   └── ui/                         render puro: dom, screens, caseUI, tribunalUI, resultsUI, quizUI
├── cases/
│   ├── schema.json
│   ├── index.json                  lista de casos que carga la version modular
│   ├── DEMO-001.json               caso de prueba NO MÉDICO (valida el motor)
│   ├── MI-003.json                 asma bronquial, citado a la NNAC 2025
│   ├── MI-021.json                 neumonia adquirida en la comunidad
│   ├── TRA-011.json                fractura distal del radio
│   ├── URG-016.json                intoxicacion por organofosforados
│   └── PED-007.json                diarrea persistente
├── preguntas/
│   ├── banco.json                  preguntas de opción múltiple, cada una con cita textual y página
│   └── fuentes.json                catálogo de normas: PDF, texto extraído y desfase de páginas
├── fuentes/                        PDFs de respaldo (NO se publican, ~70 MB)
│   ├── nnac/                       NNAC 2025: Medicina Interna, Traumatologia, Urgencias, Pediatria
│   ├── caracterizacion/            normas de caracterizacion de primer nivel (2013) y segundo nivel (2014)
│   └── texto/                      texto de cada PDF, página por página (lo usa el validador)
├── revision/                       clave de respuestas (NO se publica)
├── tools/
│   ├── validate.mjs                casos + banco
│   ├── banco.mjs                   verificador de citas del banco
│   ├── extraer-texto.mjs
│   ├── clave.mjs                   genera revision/clave-de-respuestas.md
│   ├── build.mjs
│   └── smoke.mjs
├── AUTORIA.md                      ← cómo convertir una norma en caso y anclar niveles
└── README.md
```

---

## Banco de preguntas

Pestaña **Preguntas**: rondas de 10 preguntas de opción múltiple, por área o
de todo el banco. A diferencia del caso clínico, aquí el error se muestra en el
momento: la respuesta correcta, una explicación corta y **la frase textual de
la norma con su página**. La selección prioriza lo nunca visto y lo fallado, y
hay un botón para repetir solo las falladas.

**Cómo se verifica.** Cada pregunta lleva `fuente: { id, pagina, cita }`. El
validador busca la cita, sin importar tildes, mayúsculas ni puntuación, en el
texto de esa página del PDF oficial. Si la cita no aparece o está en otra
página, es error. Lo que la máquina no puede comprobar (que la cita respalde de
verdad la opción marcada como correcta) queda para la revisora, que solo
tiene que leer una frase. Las 54 preguntas actuales están en `BORRADOR` hasta esa
revisión.

## Decisiones arquitectónicas

**El motor no puede inventar medicina, por construcción.** No existe ninguna
función que genere evolución del paciente. Si un dato no está en el JSON del
caso, la respuesta es "no existen resultados disponibles", nunca un resultado
fabricado. El smoke test comprueba explícitamente que no exista ninguna función
de ese tipo.

**El DecisionLog es la fuente de verdad.** El tribunal y la evaluación no leen
la interfaz: leen el log. Por eso la pantalla de resultados puede mostrar la
secuencia real de decisiones con sus tiempos, que resultó ser una de las partes
más útiles: ver que pediste estudios antes de pensar es información que ninguna
barra de porcentaje te da.

**El tribunal es determinista.** Las preguntas ya están escritas en el caso;
este motor solo decide cuáles se disparan. Dos partidas idénticas producen el
mismo examen oral. Cuando entre IA (v0.4) será capa de repregunta **no
puntuada**: la nota siempre sale de la rúbrica.

**La autoevaluación del tribunal la hace ella, no un matcher.** Después de
responder en voz alta ve `loQueSeEsperaOir` y se califica completa / a medias /
no supe. Un comparador de texto no puede juzgar una respuesta oral, y fingir
que sí sería peor que pedir honestidad.

**Nada se marca incorrecto por no estar en la base.** Lo único que baja el
puntaje es no haber hecho lo que la fuente marca como ESPERADO. Todo lo demás
aparece bajo "no evaluable con la fuente disponible".

---

## Desviaciones respecto del documento de especificación

Las tres, explicadas como pide la regla 1 del documento.

**1. Declarar antes de revelar** (`caseEngine.js`). El documento decía que al
pulsar "Interrogar" aparecen los antecedentes. Eso entrena reconocimiento
—elegir de un menú— cuando el examen evalúa evocación: generar las preguntas.
Aquí ella escribe primero qué iba a preguntar o buscar, su texto queda en el
DecisionLog, y recién entonces se revela el grupo. Los estudios sí son menú,
porque pedir un estudio de una lista sí es lo que se hace en la realidad.
Se puede desactivar por grupo con `exigeDeclaracionPrevia: false`.

**2. Una sola moneda.** El documento proponía XP no gastable además de Kamas.
Para una jugadora con examen en fecha fija, dos economías son complejidad sin
función. El nivel se deriva de las Kamas ganadas acumuladas.

**3. Seis dimensiones de puntaje, no nueve.** Nadie lee nueve barras. El
detalle por ítem sigue disponible, plegado.

**Cortado del alcance de la v0.1**, para que el tiempo vaya a contenido:
cofres, rarezas, sets, avatares, marcos, títulos, mascotas, logros, tienda de
cosméticos virtuales, mazmorra semanal, panel web de administración, Supabase,
login y tribunal con IA. La tienda quedó solo con recompensas externas, que son
las únicas que motivan de verdad porque tienen costo real.

---

## Estado del contenido

| Caso | Estado | Nota |
|---|---|---|
| DEMO-001 "La fragua apagada" | VALIDADO | No médico. Existe para validar el motor sin riesgo clínico. |
| MI-003 Crisis asmática | BIBLIOGRAFIA_VERIFICADA | Citado página por página a la NNAC de Medicina Interna 2025. **Falta la revisión por una segunda persona del área antes de pasarlo a VALIDADO.** |
| MI-021 Neumonía adquirida en la comunidad | BORRADOR | NNAC Medicina Interna, cap. 21 (pp. 199–206). CURB-65 de 2; la urea solo existe desde nivel 2. |
| TRA-011 Fractura distal del radio | BORRADOR | NNAC Traumatología, cap. 11 (pp. 58–61). Colles cerrada y desplazada; en nivel 1 no hay rayos X. |
| URG-016 Intoxicación por organofosforados | BORRADOR | NNAC Urgencias y Emergencias, cap. 16 (pp. 142–153). Intento suicida con clorpirifos. |
| PED-007 Diarrea persistente | BORRADOR | NNAC Pediatría, cap. 7 (pp. 59–61). Sin deshidratación, con antibiótico previo sin cultivo. |

Los cuatro casos nuevos están en BORRADOR: se jugan igual, pero falta que
alguien confirme cada página contra el PDF impreso y la revisión por una segunda
persona del área. Cada `notaDeAutoria` lista los errores de edición que se
encontraron en la norma y que **no** se usaron en la rúbrica.

**Niveles de atención anclados.** Desde esta versión el `nivelMinimo` de cada
estudio cita la norma de caracterización que lo respalda (ver AUTORIA.md, paso
3b). En el juego, nivel 1 es el Centro de Salud con Internación. Si la jugadora
pide un estudio que no existe en su nivel, el juego le muestra qué dice la norma
y ese estudio no le resta puntaje. `node tools/validate.mjs` lista los anclajes
que siguen pendientes.

MI-003 sale del capítulo 3 "Asma Bronquial" (pp. 40–51) de la Norma Nacional de
Atención Clínica de Medicina Interna, Serie: Documentos Técnico Normativos
No. 540, RM 0456 del 30 de septiembre de 2025. La viñeta clínica la redactó el
autor del caso; todo lo evaluable proviene de ese capítulo, con página en cada
ítem.

### Bibliografía disponible para seguir

Todo descargable y gratuito:

- **Seis NNAC actualizadas en octubre de 2025** (RM 0456): Medicina Interna
  (27 capítulos), Pediatría, Urgencias y Emergencias, Traumatología, Terapia
  Intensiva, Neurología — `minsalud.gob.bo`, sección Normas y Manuales.
- **Gineco-obstetricia**: no está entre las seis actualizadas. Revisar qué
  versión sigue vigente. Mientras: Guía de Atención Materna y Neonatal con
  Enfoque Intercultural (pub. 534, 2024), Norma Técnica de la Iniciativa
  Hospitales Amigos de la Madre y la Niñez.
- **Neonatología y pediatría de primer nivel**: Cuadros de Procedimientos AIEPI
  y AIEPI Neonatal, Manual de Atención Neonatal — `docs.bvsalud.org`.
- **Salud pública y normativa**: Norma Nacional de Referencia y
  Contrarreferencia (pub. 289), normas de caracterización de establecimientos
  de primer y segundo nivel, Norma Nacional de la Gestión Hospitalaria (2025),
  manuales del Bono Juana Azurduy (2025), Norma Técnica para el Manejo del
  Expediente Clínico y guía de Consentimiento Informado (publicadas por la
  CNS), Ley 1152 y su reglamento.

**Bajar los PDF hoy y guardarlos versionados.** Las normas se actualizan y los
enlaces se mueven; si en dos meses cambia la página, la base bibliográfica se
queda sin respaldo.

---

## Siguiente paso lógico

El motor ya está probado. **El cuello de botella ahora es la autoría, no el
código.** El orden que rinde:

1. Que ella juegue MI-003 y DEMO-001 esta semana y diga qué le sobra y qué le
   falta. Ocho casos alcanzan para saber si el ciclo engancha; ese feedback
   vale más que cuatro semanas de código a ciegas.
2. Escribir 8 a 10 casos siguiendo `AUTORIA.md`, repartidos entre las cinco
   áreas. **Que los escriba ella siempre que se pueda**: convertir un capítulo
   en caso es mejor estudio que releerlo, y resuelve la validación.
3. Recién entonces, si sobra tiempo: banco de preguntas como modo aparte, que
   es el contenido más barato de producir en volumen.

Y una regla de calendario: **las últimas dos semanas antes del examen, cero
desarrollo.** Solo simulacros orales con alguien haciendo de tribunal.

---

## Limitaciones conocidas

- El progreso se guarda en `localStorage`, o sea en ese navegador y ese
  teléfono. No se sincroniza entre dispositivos. Hay exportar/importar en el
  mapa. Migrar a Supabase toca solo `storage.js`.
- El matcher de texto libre es por sinónimos. Si un caso puntúa mal sin razón,
  casi siempre faltan sinónimos en la rúbrica.
- El matcher compara por subcadena en los dos sentidos: un sinónimo que
  contiene la palabra de otra conducta (p. ej. "prueba de la atropina" frente a
  "atropina") hace que escribir solo esa palabra active las dos. Al escribir
  sinónimos de una conducta NO_CONTEMPLADO, evitar palabras que la jugadora usa
  para la conducta correcta.
- El repositorio es público: cualquiera puede leer los casos y sus rúbricas.
  `revision/` (la clave de respuestas) y los PDFs están en `.gitignore`.
- La `nota` global es la media de seis dimensiones sin ponderar. Cuando haya
  más casos jugados conviene revisar si esos pesos representan lo que importa.
