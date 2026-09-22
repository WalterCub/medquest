# Cómo convertir un capítulo de la norma en un caso

Este es el documento más importante del proyecto. El motor ya está hecho; lo
que decide si MedQuest sirve o no es cuántos casos existen y si son confiables.

La buena noticia: **un capítulo de la Norma Nacional de Atención Clínica ya es
un caso casi escrito.** Su estructura mapea casi campo por campo contra el
schema. No estás autoreando desde cero, estás transcribiendo con una viñeta
clínica adelante.

Objetivo realista: **45 a 60 minutos por caso** una vez que le tomas la mano.

---

## El mapeo

| En el capítulo de la norma | En el caso JSON |
|---|---|
| Título del capítulo y CIE-10 | `titulo`, `subarea` |
| "NIVEL DE ATENCIÓN I - II - III" | `nivelesDisponibles` |
| Definición, factores de riesgo, epidemiología | contexto para redactar la viñeta |
| Manifestaciones clínicas | `descubrimiento.anamnesis`, `rubrica.informacionCritica` |
| Examen físico (dentro de manifestaciones) | `descubrimiento.examenFisico` |
| Clasificación (tablas) | `rubrica.diagnosticosEsperados`, `conceptosClave` |
| Exámenes complementarios | `descubrimiento.laboratorio` / `gabinete`, `rubrica.estudios` |
| Diagnóstico diferencial | `rubrica.diagnosticosDiferenciales` |
| Tratamiento por nivel (PRIMER / SEGUNDO / TERCER NIVEL) | `rubrica.conductas` con su campo `nivel` |
| Criterios de hospitalización / referencia / alta / contrarreferencia | `rubrica.conductas` y `conceptosClave` |
| Complicaciones, recomendaciones, prevención | `rubrica.conductas` de valoración ACEPTABLE |

El campo `nivel` de las conductas es lo que hace funcionar el modo provincia.
La norma ya trae el tratamiento desglosado por nivel de atención: solo hay que
copiar esa división. No es contenido extra.

---

## El procedimiento, paso a paso

### 1. Elige el capítulo y ábrelo en el PDF
Anota de una vez el número de publicación, el año, la resolución ministerial y
el rango de páginas. Eso va entero en `fuentes[0]`. Si no lo anotas ahora, no
lo vas a anotar nunca.

### 2. Escribe la viñeta (lo único que inventas)
Entre 60 y 110 palabras. Edad, sexo, motivo de consulta, evolución, y signos
vitales concretos. Redáctala **para que apliquen los criterios de la norma**:
si la norma clasifica por frecuencia de síntomas, la viñeta tiene que permitir
averiguar esa frecuencia.

Regla dura: la viñeta es tuya, **la rúbrica no.** Declara esa diferencia en
`notaDeAutoria`. Nunca inventes un hallazgo para que el caso "cierre mejor".

### 3. Reparte el capítulo en `descubrimiento`
Las manifestaciones clínicas se vuelven ítems de `anamnesis`. Los factores de
riesgo se vuelven `antecedentes`. Los signos físicos se vuelven `examenFisico`.
Los exámenes complementarios se vuelven `laboratorio` / `gabinete` con su
`nivelMinimo`.

Marca `critico: true` solo los ítems sin los cuales el caso no se sostiene.
Cada uno de esos tiene que aparecer también en `rubrica.informacionCritica`,
porque es ahí donde su omisión genera pregunta de tribunal. El validador te
avisa si te olvidas.

### 3b. Ancla cada `nivelMinimo` a una norma de caracterización
El nivel desde el que existe un estudio no lo decide el autor: lo dice la
norma de caracterización de establecimientos. Están en `fuentes/caracterizacion/`
y se agregan a `fuentes` del caso como cualquier otra fuente.

**Qué es "nivel 1" en el juego:** el Centro de Salud con Internación (rural),
que es donde se hace el año de provincia. La norma de primer nivel (pub. 284,
2013) no es uniforme; su Cuadro N.º 5 (pp. 35–40) dice:

| Establecimiento | Laboratorio | Imagen |
|---|---|---|
| Puesto de salud | pruebas rápidas (gota gruesa) | — |
| C.S. ambulatorio | no realiza | — |
| **C.S. con internación** | **laboratorio básico** | — |
| C.S. integral | laboratorio completo (hematología, serología, bioquímica, microbiología, p. 204) | radiología y ecografía |

El laboratorio básico (p. 121) tiene analizador hematológico, contador
diferencial, lector de hematocrito, microscopio, centrífuga y rotador
serológico. No lista química sanguínea, cultivos, oxímetro, flujómetro,
espirómetro ni electrocardiógrafo. Enfermería tiene tubo de oxígeno y
nebulizador (p. 120).

Cada estudio lleva, además de `nivelMinimo`:

```json
"nivelFuente": 1,
"nivelPagina": "37, 121",
"nivelNota": "Lo que dice la norma, en una frase. Se muestra si se pide el estudio en un nivel donde no existe.",
"nivelAnclaje": "COMPLETO"
```

`COMPLETO` si la norma confirma las dos cosas: que el estudio no está en el
nivel inferior y que sí está en `nivelMinimo`. `PARCIAL` si solo confirma una.
El validador avisa por cada estudio sin ancla o con ancla parcial: esa lista
de avisos es la lista de pendientes.

Pendientes conocidos: de la norma de segundo nivel (pub. 285, 2014) solo se
pudieron bajar los capítulos I–VI. El detalle de laboratorio e imagen está en
el **cap. XIII** (y en el IX y el XII); cuando se bajen, la mayoría de los
anclajes `PARCIAL` pasan a `COMPLETO`. No existe norma de caracterización de
tercer nivel publicada.

### 4. Llena la rúbrica con `valoracion` y `pagina`
Cuatro valoraciones y el criterio de cada una:

- `ESPERADO` — la norma lo dice y para este caso corresponde. Es lo único que
  baja el puntaje si falta.
- `ACEPTABLE` — la norma lo contempla y no está mal hacerlo.
- `OPCIONAL` — figura en la norma pero no aporta a este caso concreto.
- `NO_CONTEMPLADO_POR_LA_FUENTE` — la norma no lo respalda **para esta
  situación**. No resta: genera pregunta de tribunal.

**Cita casi textual.** En vez de parafrasear "hay que dar corticoide", escribe
"En crisis moderada la fuente indica prednisona 1 a 2 mg/kg/día por vía oral e
hidrocortisona 4 a 6 mg/kg por vía intravenosa" con su página. Si la fuente lo
dice, que lo diga la fuente. Un error de paráfrasis es un concepto falso
memorizado justo antes del examen.

**Si la norma no lo dice, no va.** El impulso de agregar lo que sabes de otro
lado es el único que puede arruinar el proyecto. Si un dato te parece
imprescindible y la norma no lo trae, o buscas otra fuente y la agregas a
`fuentes`, o lo dejas fuera.

### 5. Los `sinonimos` son lo que hace funcionar la evaluación
Quien juega escribe en texto libre. El matcher compara contra `clave` y
`sinonimos`. Pon todas las formas en que alguien escribiría eso: abreviatura,
nombre completo, nombre coloquial, con y sin tilde. Si un caso puntúa mal sin
razón, casi siempre faltan sinónimos.

### 6. Escribe el tribunal
Apunta a entre 15 y 25 preguntas. La mezcla que funciona:

- **5 a 8 de `siempre`** — diagnóstico, clasificación, diferenciales, criterios
  de alta, y **siempre una de "estás en primer nivel a dos horas del hospital,
  qué haces"**. Esa es la que más se pregunta en el examen real.
- **`siPidio` / `siNoPidio`** para cada estudio ESPERADO y para los que quieras
  que justifique.
- **`siConducta`** para cada conducta `NO_CONTEMPLADO_POR_LA_FUENTE`. Si no le
  pones pregunta, se elige y no pasa nada; el validador te avisa.
- **`siNoConducta`** para las conductas ESPERADO que más se olvidan.
- **`siOmitioInfo`** para cada ítem de `informacionCritica`.

`loQueSeEsperaOir` no es opcional en la práctica: es lo que se lee
para autoevaluarse. Sin eso se califica a ciegas.

### 7. Llena `estudiosPlausiblesNoIncluidos`
Tres o cuatro estudios que alguien pediría con sentido y que el caso no trae.
Cada uno con su pregunta de tribunal. Esto evita que la app se sienta muerta
cuando pide algo razonable y solo recibe un "no hay resultado".

### 8. Valida
```
node tools/validate.mjs cases/MI-004.json
```
El validador revisa integridad referencial: que cada ítem apunte a una fuente
que existe, que cada disparador del tribunal apunte a una clave que existe (una
pregunta con clave equivocada no se dispara nunca y no lo notarías), y que un
caso `VALIDADO` no tenga agujeros bibliográficos.

### 9. Estado
- `BORRADOR` mientras lo escribes. Sirve para probar el software.
- `BIBLIOGRAFIA_VERIFICADA` cuando cada ítem tiene fuente y página y las
  verificaste contra el PDF.
- `VALIDADO` **solo después de que una segunda persona del área lo revise.**
  Este paso no es un trámite: es la única defensa real contra un error de
  rúbrica. Y revisar casos es, en sí, una forma muy buena de estudiar.

---

## Cuánto rinde cada norma

| Norma | Capítulos | Área |
|---|---|---|
| NNAC Medicina Interna (pub. 540, 2025) | 27 | MI |
| NNAC Pediatría (2025) | — | PED |
| NNAC Urgencias y Emergencias (2025) | — | CX / MI |
| NNAC Traumatología (2025) | — | CX |
| NNAC Terapia Intensiva (2025) | — | MI |
| NNAC Neurología (2025, 156 p.) | — | MI |

Solo el capítulo de Medicina Interna tiene 27 patologías, cada una con su
estructura completa. No hace falta convertirlas todas: 8 o 10 bien elegidas por
área alcanzan para que el motor tenga de dónde sacar.

Para Gineco-obstetricia y para salud pública hay que ir a otras fuentes
(guías materno-neonatales, AIEPI, PAI, Ley 1152, norma de referencia y
contrarreferencia). Están listadas en el README.

---

## Preguntas para el banco

Mucho más rápido que un caso: 3 a 5 minutos por pregunta.

1. Busca en el capítulo una frase que por sí sola responda la pregunta: una
   dosis, un umbral, un criterio. Mejor en prosa que en una tabla, porque las
   tablas se desordenan al extraer el texto del PDF.
2. Copia la frase **tal cual** en `fuente.cita`, con la página impresa en
   `fuente.pagina`. No la corrijas aunque tenga errores de tipeo: se compara
   contra el PDF.
3. Escribe el enunciado y 4 opciones. Los distractores tienen que ser
   plausibles pero claramente contradichos por la norma, no "más o menos".
4. Evita preguntar justo lo que la norma dice de dos formas distintas (por
   ejemplo, la adrenalina aparece como 0,3–0,5 mg en una página y 0,5 mg en otra).
5. `node tools/validate.mjs`. Si la cita no está, te dice en qué página sí está
   o que no existe.
6. Queda en `BORRADOR` hasta que otra persona confirme que la cita respalda la
   respuesta; entonces pasa a `VERIFICADA`.

## Las tres reglas que no se negocian

1. **Si la norma no lo dice, no va en la rúbrica.**
2. **La viñeta es del autor; la rúbrica es de la fuente.** Declararlo en
   `notaDeAutoria` no es formalidad: es lo que permite que alguien revise.
3. **`VALIDADO` exige revisión de una segunda persona del área.** El modo
   examen solo debería usar casos validados.
