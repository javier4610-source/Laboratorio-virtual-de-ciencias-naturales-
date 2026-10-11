"""Genera las guías de trabajo en PDF de cada práctica del Laboratorio Virtual.

Formato institucional de la I.E. Campo Alegre (Apartadó, Antioquia), docente Javier Rentería:
encabezado institucional, marca del docente, identificación del estudiante, DBA (propuesta),
actividades, tabla de datos, cuadrícula para graficar, evaluación por competencias,
rúbrica por niveles, observaciones y nota de cierre. Cada guía incluye un código QR que
abre la práctica en línea.

Por cada práctica se generan dos archivos en guias-pdf/:
  estudiante/guia-<id>.pdf   guía para el estudiante (sin respuestas)
  docente/clave-<id>.pdf     clave de respuestas y notas del modelo (uso exclusivo del docente)

Uso:  npm run guias        (exporta el contenido y genera los PDF)
Logo: coloque el logo institucional en scripts/guias/assets/LOGO_COLEGIOS.png
"""

import json
import os
import sys
from xml.sax.saxutils import escape

from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Circle, Drawing, String
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (CondPageBreak, Flowable, Image, KeepTogether, Paragraph,
                                SimpleDocTemplate, Spacer, Table, TableStyle)

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, '..', '..'))
SALIDA = os.path.join(RAIZ, 'guias-pdf')
URL_BASE = os.environ.get('LAB_URL', 'https://javier4610-source.github.io/Laboratorio-virtual-de-ciencias-naturales-/')
LOGO = os.path.join(AQUI, 'assets', 'LOGO_COLEGIOS.png')

DOCENTE = 'JAVIER RENTERÍA'
INSTITUCION = 'INSTITUCIÓN EDUCATIVA CAMPO ALEGRE'
LEMA = '"La exigencia es la base de la excelencia"'

VERDE_OSCURO = colors.HexColor('#1B5E20')
VERDE = colors.HexColor('#2E7D32')
VERDE_SUAVE = colors.HexColor('#E8F5E9')
NARANJA = colors.HexColor('#FF6F00')
ROJO = colors.HexColor('#C62828')
GRIS = colors.HexColor('#5f6b66')
LINEA = colors.HexColor('#9aa5a0')

AREAS = {'biologia': 'Biología', 'quimica': 'Química', 'fisica': 'Física', 'ambiental': 'Ciencias ambientales'}
COMPETENCIAS = {
    'uso': 'Uso comprensivo del conocimiento científico',
    'explicacion': 'Explicación de fenómenos',
    'indagacion': 'Indagación',
}

# ---------------------------------------------------------------- fuentes

def registrar_fuentes():
    """DejaVu cubre letras griegas, subíndices y flechas que usan las prácticas."""
    rutas = ['/usr/share/fonts/truetype/dejavu', '/usr/share/fonts/dejavu', '/Library/Fonts', 'C:/Windows/Fonts']
    for base in rutas:
        normal, negrita, cursiva = (os.path.join(base, f) for f in ('DejaVuSans.ttf', 'DejaVuSans-Bold.ttf', 'DejaVuSans-Oblique.ttf'))
        if os.path.exists(normal) and os.path.exists(negrita):
            pdfmetrics.registerFont(TTFont('Guia', normal))
            pdfmetrics.registerFont(TTFont('Guia-B', negrita))
            pdfmetrics.registerFont(TTFont('Guia-I', cursiva if os.path.exists(cursiva) else normal))
            pdfmetrics.registerFontFamily('Guia', normal='Guia', bold='Guia-B', italic='Guia-I', boldItalic='Guia-B')
            return
    sys.exit('No se encontró la fuente DejaVu Sans (instale fonts-dejavu).')


def estilos():
    base = dict(fontName='Guia', fontSize=9.5, leading=13, textColor=colors.HexColor('#1d2622'))
    return {
        'normal': ParagraphStyle('normal', **base),
        'peq': ParagraphStyle('peq', **{**base, 'fontSize': 8, 'leading': 10.5}),
        'tabla': ParagraphStyle('tabla', **{**base, 'fontSize': 7.6, 'leading': 9.6}),
        'titulo': ParagraphStyle('titulo', **{**base, 'fontName': 'Guia-B', 'fontSize': 15, 'leading': 19, 'textColor': VERDE_OSCURO}),
        'seccion': ParagraphStyle('seccion', **{**base, 'fontName': 'Guia-B', 'fontSize': 10.5, 'leading': 13, 'textColor': colors.white}),
        'pregunta': ParagraphStyle('pregunta', **{**base, 'fontName': 'Guia-B'}),
        'opcion': ParagraphStyle('opcion', **{**base, 'leftIndent': 14}),
        'centro': ParagraphStyle('centro', **{**base, 'alignment': TA_CENTER}),
        'blanco': ParagraphStyle('blanco', **{**base, 'textColor': colors.white, 'alignment': TA_CENTER, 'fontSize': 8.5, 'leading': 11}),
        'banner': ParagraphStyle('banner', **{**base, 'textColor': colors.white, 'alignment': TA_CENTER, 'fontSize': 8.5, 'leading': 14.5}),
        'cabecera': ParagraphStyle('cabecera', **{**base, 'fontName': 'Guia-B', 'fontSize': 7.6, 'leading': 9.6, 'textColor': colors.white}),
        'cabecera-peq': ParagraphStyle('cabecera-peq', **{**base, 'fontName': 'Guia-B', 'fontSize': 6.1, 'leading': 7.6, 'textColor': colors.white}),
    }


def t(texto):
    """Escapa texto para Paragraph."""
    return escape(str(texto))

# ---------------------------------------------------------------- piezas


class Renglones(Flowable):
    """Renglones para escribir a mano."""

    def __init__(self, n=3, alto=0.75 * cm):
        super().__init__()
        self.n, self.alto = n, alto

    def wrap(self, ancho, _alto):
        self.ancho = ancho
        return ancho, self.n * self.alto

    def draw(self):
        self.canv.setStrokeColor(LINEA)
        self.canv.setLineWidth(0.5)
        for i in range(self.n):
            y = i * self.alto + 2
            self.canv.line(0, y, self.ancho, y)


class Cuadricula(Flowable):
    """Cuadrícula para que el estudiante construya su gráfica."""

    def __init__(self, xlabel, ylabel, alto=8.5 * cm):
        super().__init__()
        self.xlabel, self.ylabel, self.alto = xlabel, ylabel, alto

    def wrap(self, ancho, _alto):
        self.ancho = ancho
        return ancho, self.alto

    def draw(self):
        c = self.canv
        x0, y0 = 1.2 * cm, 1.0 * cm
        w, h = self.ancho - x0 - 0.3 * cm, self.alto - y0 - 0.2 * cm
        paso = 0.5 * cm
        c.setStrokeColor(colors.HexColor('#cfd8d3'))
        c.setLineWidth(0.3)
        x = x0
        while x <= x0 + w + 0.1:
            c.line(x, y0, x, y0 + h)
            x += paso
        y = y0
        while y <= y0 + h + 0.1:
            c.line(x0, y, x0 + w, y)
            y += paso
        c.setStrokeColor(colors.HexColor('#1d2622'))
        c.setLineWidth(1)
        c.line(x0, y0, x0 + w, y0)
        c.line(x0, y0, x0, y0 + h)
        c.setFont('Guia', 8)
        c.setFillColor(GRIS)
        c.drawCentredString(x0 + w / 2, 0.3 * cm, self.xlabel)
        c.saveState()
        c.translate(0.45 * cm, y0 + h / 2)
        c.rotate(90)
        c.drawCentredString(0, 0, self.ylabel)
        c.restoreState()


def barra_seccion(texto, est, color=VERDE):
    tabla = Table([[Paragraph(t(texto), est['seccion'])]], colWidths=['100%'])
    tabla.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), color),
        ('LEFTPADDING', (0, 0), (-1, -1), 8), ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    return tabla


def logo(ancho=2.1 * cm):
    if os.path.exists(LOGO):
        return Image(LOGO, width=ancho, height=ancho, kind='proportional')
    # Marcador neutro mientras se agrega el logo oficial.
    d = Drawing(ancho, ancho)
    r = ancho / 2
    d.add(Circle(r, r, r - 1, fillColor=colors.white, strokeColor=colors.white))
    d.add(Circle(r, r, r - 4, fillColor=VERDE_OSCURO, strokeColor=colors.white, strokeWidth=1.2))
    d.add(String(r, r - 4, 'IECA', fontName='Guia-B', fontSize=ancho / 4.2, fillColor=colors.white, textAnchor='middle'))
    return d


def codigo_qr(url, lado=3.0 * cm):
    w = qr.QrCodeWidget(url)
    x1, y1, x2, y2 = w.getBounds()
    d = Drawing(lado, lado, transform=[lado / (x2 - x1), 0, 0, lado / (y2 - y1), 0, 0])
    d.add(w)
    return d


def encabezado(est, subtitulo):
    texto = (
        f'<font size="7.5">REPÚBLICA DE COLOMBIA · MUNICIPIO DE APARTADÓ, ANTIOQUIA</font><br/>'
        f'<font name="Guia-B" size="12.5">{INSTITUCION}</font><br/>'
        f'<font size="7">Resolución 188 del 16 de abril de 2013 · DANE: 405045001334 · NIT: 900424328-5</font><br/>'
        f'<font name="Guia-I" size="8">{t(LEMA)}</font>'
    )
    banner = Table([[logo(), Paragraph(texto, est['banner']), '']], colWidths=[2.6 * cm, None, 2.6 * cm])
    banner.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), VERDE_OSCURO),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('ALIGN', (0, 0), (0, 0), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 6), ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    marca = Table([[Paragraph(f'<font name="Guia-B">Docente: {DOCENTE}</font> &nbsp;|&nbsp; Ciencias Naturales y Educación Ambiental &nbsp;|&nbsp; {t(subtitulo)}', est['blanco'])]], colWidths=['100%'])
    marca.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), NARANJA), ('TOPPADDING', (0, 0), (-1, -1), 3), ('BOTTOMPADDING', (0, 0), (-1, -1), 4)]))
    return [banner, marca, Spacer(1, 8)]


def tabla_simple(filas, anchos, est, cabecera=True, color=VERDE, fuente='tabla', cab='cabecera'):
    def celda(c, i):
        if isinstance(c, Flowable):
            return c
        estilo = est[cab] if cabecera and i == 0 else est[fuente]
        return Paragraph(t(c) if not str(c).startswith('<') else str(c), estilo)
    datos = [[celda(c, i) for c in fila] for i, fila in enumerate(filas)]
    tabla = Table(datos, colWidths=anchos, repeatRows=1 if cabecera else 0)
    estilo = [
        ('GRID', (0, 0), (-1, -1), 0.5, LINEA),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4), ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]
    if cabecera:
        estilo += [('BACKGROUND', (0, 0), (-1, 0), color), ('TEXTCOLOR', (0, 0), (-1, 0), colors.white)]
    tabla.setStyle(TableStyle(estilo))
    return tabla


def tabla_variables(est):
    tabla = tabla_simple([['Variable independiente (la que cambio)', 'Variable dependiente (la que mido)', 'Variables controladas (no cambian)'], ['', '', '']],
                         [5.93 * cm] * 3, est)
    tabla.setStyle(TableStyle([('TOPPADDING', (0, 1), (-1, 1), 30), ('BOTTOMPADDING', (0, 1), (-1, 1), 30)]))
    return tabla


def pie(titulo):
    def dibujar(canv, doc):
        canv.saveState()
        canv.setFont('Guia', 7.5)
        canv.setFillColor(GRIS)
        canv.drawString(doc.leftMargin, 1.1 * cm, f'I.E. Campo Alegre · Docente {DOCENTE.title()} · {titulo}')
        canv.drawRightString(doc.pagesize[0] - doc.rightMargin, 1.1 * cm, f'Página {doc.page}')
        canv.restoreState()
    return dibujar

# ---------------------------------------------------------------- rúbrica

RUBRICA = [
    ('Comprensión conceptual', '30 %',
     'Explica con precisión los conceptos de la práctica, los relaciona con el modelo y los aplica a situaciones nuevas.',
     'Explica correctamente los conceptos principales, con imprecisiones menores.',
     'Reconoce los conceptos, pero sus explicaciones son incompletas o repetitivas.',
     'Presenta confusiones conceptuales importantes o no explica.'),
    ('Desarrollo de actividades', '25 %',
     'Completa todas las actividades; registra los ensayos pedidos con unidades y construye la gráfica correctamente.',
     'Completa casi todas las actividades; datos y gráfica con errores menores.',
     'Completa parte de las actividades; pocos ensayos, datos sin unidades o gráfica incompleta.',
     'Deja la mayoría de las actividades sin desarrollar.'),
    ('Análisis y pensamiento crítico', '20 %',
     'Contrasta la hipótesis con los datos, identifica tendencias y límites del modelo, y concluye con afirmación, evidencia y razonamiento.',
     'Compara hipótesis y datos y concluye con evidencia, aunque el razonamiento es parcial.',
     'Describe los datos, pero no los usa para justificar la conclusión.',
     'No analiza los datos o concluye sin relación con ellos.'),
    ('Participación y actitud', '15 %',
     'Trabaja con autonomía, colabora, administra el tiempo y formula preguntas propias.',
     'Participa activamente y colabora con su equipo.',
     'Participa cuando se le solicita; requiere acompañamiento constante.',
     'Muestra poco interés o interfiere con el trabajo del grupo.'),
    ('Presentación y orden', '10 %',
     'La guía está completa, ordenada, legible y con ortografía cuidada.',
     'La guía está ordenada y legible, con algunos descuidos.',
     'La guía está incompleta o es difícil de leer en algunas partes.',
     'La guía está desordenada o ilegible.'),
]
NIVELES = [('Superior', '4,6 – 5,0'), ('Alto', '4,0 – 4,5'), ('Básico', '3,0 – 3,9'), ('Bajo', '1,0 – 2,9')]


def bloque_rubrica(est):
    filas = [['Criterio', 'Peso'] + [f'{n} ({r})' for n, r in NIVELES]]
    for crit in RUBRICA:
        filas.append([f'<b>{t(crit[0])}</b>', crit[1], *crit[2:]])
    ancho = [2.9 * cm, 1.1 * cm] + [3.6 * cm] * 4
    tabla = tabla_simple(filas, ancho, est, color=ROJO)
    leyenda = Paragraph(
        '<b>Niveles de desempeño:</b> Superior (4,6 – 5,0): supera lo esperado · Alto (4,0 – 4,5): logra lo esperado · '
        'Básico (3,0 – 3,9): logra lo mínimo · Bajo (1,0 – 2,9): no alcanza lo mínimo.', est['peq'])
    return [barra_seccion('RÚBRICA DE EVALUACIÓN', est, ROJO), Spacer(1, 4), tabla, Spacer(1, 4), leyenda]

# ---------------------------------------------------------------- preguntas


def bloque_pregunta(num, q, est, con_clave=False):
    partes = []
    if q.get('context'):
        partes.append(Paragraph(f'<i>{t(q["context"])}</i>', est['normal']))
    if q.get('table'):
        tb = q['table']
        filas = [tb['headers']] + [[str(v).replace('.', ',') if isinstance(v, float) else str(v) for v in fila] for fila in tb['rows']]
        n = len(tb['headers'])
        partes += [Paragraph(f'<font size="7.5" color="#5f6b66">{t(tb["caption"])}</font>', est['normal']),
                   tabla_simple(filas, [min(3.2 * cm, 17 * cm / n)] * n, est)]
    partes.append(Paragraph(f'{num}. {t(q["stem"])}', est['pregunta']))
    for o in q['options']:
        marca = '●' if con_clave and o['id'] == q['correct'] else '○'
        partes.append(Paragraph(f'{marca} {o["id"].upper()}. {t(o["text"])}', est['opcion']))
    partes.append(Spacer(1, 6))
    return KeepTogether(partes)

# ---------------------------------------------------------------- guía del estudiante


def guia_estudiante(p, est, ruta):
    url = f'{URL_BASE}#/practica/{p["id"]}'
    area = AREAS.get(p['area'], p['area'])
    doc = SimpleDocTemplate(ruta, pagesize=letter, leftMargin=1.6 * cm, rightMargin=1.6 * cm, topMargin=1.3 * cm, bottomMargin=1.7 * cm,
                            title=f'Guía: {p["title"]}', author=f'{DOCENTE.title()} · I.E. Campo Alegre', subject='Guía de laboratorio virtual de Ciencias Naturales')
    h = encabezado(est, f'Grado {p["grade"]}.º')
    h += [Paragraph('GUÍA DE LABORATORIO VIRTUAL', ParagraphStyle('x', parent=est['peq'], textColor=NARANJA, fontName='Guia-B')),
          Paragraph(t(p['title']), est['titulo']), Spacer(1, 4)]
    info = [
        [f'<b>Grado:</b> {p["gradeName"]} ({p["grade"]}.º)', f'<b>Área:</b> {area}', f'<b>Duración:</b> {p["durationMin"]} min'],
        [f'<b>Tema:</b> {t(p["topic"])}', '<b>Período:</b> ______', '<b>Fecha:</b> ____________'],
    ]
    h.append(tabla_simple(info, [9 * cm, 4.2 * cm, 4.6 * cm], est, cabecera=False, fuente='peq'))
    h.append(Spacer(1, 4))
    est_id = [['<b>Nombre completo:</b>', '', '<b>Grupo:</b>', ''], ['<b>Integrantes del equipo:</b>', '', '<b>Calificación:</b>', '']]
    tb = tabla_simple(est_id, [3.6 * cm, 8.6 * cm, 2.4 * cm, 3.2 * cm], est, cabecera=False, fuente='peq')
    tb.setStyle(TableStyle([('ROWBACKGROUNDS', (0, 0), (-1, -1), [colors.white]), ('TOPPADDING', (0, 0), (-1, -1), 7), ('BOTTOMPADDING', (0, 0), (-1, -1), 7)]))
    h += [tb, Spacer(1, 8)]

    acceso = Table([[codigo_qr(url), Paragraph(
        f'<b>Abre la práctica en el laboratorio virtual</b><br/>Escanea el código QR o escribe en el navegador:<br/>'
        f'<font name="Guia-B" color="#1B5E20">{t(url)}</font><br/>'
        '<font size="8">Después de abrirla una vez con internet, funciona sin conexión. Elige el modo «Práctica guiada» '
        'y, al terminar, abre «Ver informe» para entregar tu trabajo.</font>', est['normal'])]], colWidths=[3.4 * cm, None])
    acceso.setStyle(TableStyle([('BACKGROUND', (0, 0), (-1, -1), VERDE_SUAVE), ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), ('BOX', (0, 0), (-1, -1), 0.8, VERDE)]))
    h += [acceso, Spacer(1, 8)]

    pq = Table([[Paragraph(f'<b>Pregunta problema:</b> {t(p["problemQuestion"])}', est['normal'])]], colWidths=['100%'])
    pq.setStyle(TableStyle([('LINEBEFORE', (0, 0), (0, -1), 3, NARANJA), ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#FFF3E0'))]))
    h += [pq, Spacer(1, 8)]

    h += [barra_seccion('OBJETIVOS Y REFERENTES CURRICULARES', est), Spacer(1, 4)]
    h += [Paragraph(f'• {t(o)}', est['normal']) for o in p['objectives']]
    h.append(Spacer(1, 4))
    cl = p['curricularLink']
    h += [Paragraph(f'<b>Estándar:</b> {t(cl["standards"])}', est['peq']),
          Paragraph(f'<b>DBA:</b> {t(cl["dba"])}', est['peq']),
          Paragraph('<b>Competencias:</b> ' + '; '.join(COMPETENCIAS[c] for c in p['competencies']) + '.', est['peq']),
          Spacer(1, 8)]

    h += [barra_seccion('INTRODUCCIÓN: LO QUE NECESITAS SABER', est), Spacer(1, 4)]
    h += [Paragraph(t(par), est['normal']) for par in p['background']]
    h.append(Spacer(1, 4))
    h.append(Paragraph('<b>Materiales del laboratorio virtual:</b> ' + t('; '.join(p['materials'])) + '.', est['peq']))
    h.append(Spacer(1, 8))

    # Actividad 1: hipótesis y variables
    h += [CondPageBreak(6 * cm), barra_seccion('ACTIVIDAD 1 · ANTES DE EXPERIMENTAR: HIPÓTESIS Y VARIABLES', est), Spacer(1, 4),
          Paragraph(t(p['hypothesis']['prompt']), est['normal']),
          Paragraph('<b>Mi hipótesis</b> (completa): «Si aumenta ________________________, entonces ________________________ '
                    '(aumenta / disminuye / no cambia), porque ________________________».', est['normal']),
          Renglones(3), Spacer(1, 6),
          Paragraph('Clasifica estas variables en la tabla: ' + t(' · '.join(sorted(p['variables']['independent'] + p['variables']['dependent'] + p['variables']['controlled']))) + '.', est['normal']),
          Spacer(1, 3),
          tabla_variables(est),
          Spacer(1, 8)]

    # Actividad 2: procedimiento
    h += [CondPageBreak(5 * cm), barra_seccion('ACTIVIDAD 2 · PROCEDIMIENTO EN EL LABORATORIO VIRTUAL', est), Spacer(1, 4)]
    h += [Paragraph(f'☐ <b>{i}.</b> {t(paso)}', est['normal']) for i, paso in enumerate(p['procedure'], 1)]
    h.append(Spacer(1, 8))

    # Actividad 3: datos y gráfica
    for ds in p['datasets'][:1]:
        cols = ds['columns']
        cab = [f'{c["label"]}' + (f' ({c["unit"]})' if c.get('unit') else '') for c in cols]
        n = len(cab)
        filas = [cab] + [[''] * n for _ in range(6)]
        tabla = tabla_simple(filas, [17.8 * cm / n] * n, est, cab='cabecera-peq' if n > 8 else 'cabecera')
        tabla.setStyle(TableStyle([('TOPPADDING', (0, 1), (-1, -1), 8), ('BOTTOMPADDING', (0, 1), (-1, -1), 8)]))
        lab = {c['key']: c['label'] + (f' ({c["unit"]})' if c.get('unit') else '') for c in cols}
        h += [CondPageBreak(9 * cm), barra_seccion('ACTIVIDAD 3 · REGISTRO DE DATOS Y GRÁFICA', est), Spacer(1, 4),
              Paragraph(f'Copia aquí los ensayos que guardaste en «{t(ds["label"])}». Escribe siempre las unidades.', est['normal']), Spacer(1, 3), tabla, Spacer(1, 8),
              KeepTogether([Paragraph(f'Construye la gráfica de <b>{t(lab.get(ds["defaultY"], ds["defaultY"]))}</b> contra <b>{t(lab.get(ds["defaultX"], ds["defaultX"]))}</b>. Titúlala y marca la escala de cada eje.', est['normal']),
                            Cuadricula(lab.get(ds['defaultX'], ''), lab.get(ds['defaultY'], ''))]),
              Spacer(1, 8)]

    # Actividad 4: análisis y conclusión
    h += [CondPageBreak(6 * cm), barra_seccion('ACTIVIDAD 4 · ANÁLISIS Y CONCLUSIÓN', est), Spacer(1, 4)]
    for i, preg in enumerate(p['interpretation'], 1):
        h += [KeepTogether([Paragraph(f'{i}. {t(preg)}', est['pregunta']), Renglones(3)]), Spacer(1, 4)]
    h += [KeepTogether([Paragraph(f'{len(p["interpretation"]) + 1}. ¿Tus datos apoyan o refutan tu hipótesis? Justifica con valores de tu tabla.', est['pregunta']), Renglones(3)]),
          Spacer(1, 6)]
    concl = [['Afirmación (respuesta a la pregunta problema)', ''], ['Evidencia (datos que la sostienen)', ''], ['Razonamiento (concepto científico que conecta)', '']]
    tc = tabla_simple(concl, [5.2 * cm, 12.6 * cm], est, cabecera=False)
    tc.setStyle(TableStyle([('TOPPADDING', (0, 0), (-1, -1), 20), ('BOTTOMPADDING', (0, 0), (-1, -1), 20), ('BACKGROUND', (0, 0), (0, -1), VERDE_SUAVE)]))
    h += [KeepTogether([Paragraph('<b>Conclusión</b> · ' + t(p['conclusionGuide']), est['normal']), Spacer(1, 3), tc]), Spacer(1, 8)]

    # Actividad 5: evaluación
    h += [CondPageBreak(6 * cm), barra_seccion('ACTIVIDAD 5 · EVALUACIÓN POR COMPETENCIAS', est), Spacer(1, 4),
          Paragraph('Marca una sola respuesta. Las preguntas tipo Saber 11 son originales y no oficiales del ICFES.', est['peq']), Spacer(1, 4)]
    preguntas = p['assessment'] + p['transfer']
    for i, q in enumerate(preguntas, 1):
        h.append(bloque_pregunta(i, q, est))

    # Actividad 6: aplicación
    ap = p['application']
    h += [CondPageBreak(5 * cm), barra_seccion('ACTIVIDAD 6 · APLICACIÓN EN MI CONTEXTO', est), Spacer(1, 4),
          Paragraph(f'<i>{t(ap["situation"])}</i>', est['normal']), Paragraph(t(ap['question']), est['pregunta']), Renglones(5), Spacer(1, 10)]

    h += [CondPageBreak(9 * cm)] + bloque_rubrica(est) + [Spacer(1, 8)]
    obs = tabla_simple([['Observaciones del docente', 'Calificación'], ['', '']], [13.8 * cm, 4 * cm], est, color=VERDE_OSCURO)
    obs.setStyle(TableStyle([('TOPPADDING', (0, 1), (-1, 1), 34), ('BOTTOMPADDING', (0, 1), (-1, 1), 34)]))
    h += [KeepTogether([obs]), Spacer(1, 8)]

    h += [barra_seccion('RECURSOS', est), Spacer(1, 4),
          Paragraph(f'• Laboratorio Virtual de Ciencias Naturales: {t(url)}', est['peq'])]
    h += [Paragraph(f'• {t(r)}', est['peq']) for r in p['references']]
    h += [Spacer(1, 10), Paragraph(
        f'<font color="#1B5E20"><b>Nota de cierre:</b></font> la ciencia avanza cuando alguien hace una buena pregunta y la responde con evidencia. '
        f'Revisa tus datos, sé honesto con lo que observaste y atrévete a explicar. {t(LEMA)}', est['normal'])]
    doc.build(h, onFirstPage=pie(p['title']), onLaterPages=pie(p['title']))

# ---------------------------------------------------------------- clave del docente


def clave_docente(p, est, ruta):
    doc = SimpleDocTemplate(ruta, pagesize=letter, leftMargin=1.6 * cm, rightMargin=1.6 * cm, topMargin=1.3 * cm, bottomMargin=1.7 * cm,
                            title=f'Clave del docente: {p["title"]}', author=f'{DOCENTE.title()} · I.E. Campo Alegre')
    h = encabezado(est, 'Uso exclusivo del docente')
    h += [Paragraph('CLAVE DE RESPUESTAS Y NOTAS PARA EL DOCENTE', ParagraphStyle('x', parent=est['peq'], textColor=ROJO, fontName='Guia-B')),
          Paragraph(t(p['title']), est['titulo']), Paragraph(f'Grado {p["grade"]}.º · {AREAS.get(p["area"], p["area"])} · {t(p["topic"])}', est['peq']), Spacer(1, 8)]

    h += [barra_seccion('RESPUESTAS DE LA EVALUACIÓN', est, ROJO), Spacer(1, 4)]
    filas = [['N.º', 'Clave', 'Competencia', 'Justificación científica', 'Repaso sugerido']]
    preguntas = p['assessment'] + p['transfer']
    for i, q in enumerate(preguntas, 1):
        filas.append([str(i), q['correct'].upper(), COMPETENCIAS[q['competency']], q['explanation'], q['review']])
    h += [tabla_simple(filas, [0.9 * cm, 1.3 * cm, 3.0 * cm, 8.0 * cm, 4.6 * cm], est, color=ROJO), Spacer(1, 8)]

    h += [barra_seccion('ERRORES FRECUENTES (RETROALIMENTACIÓN DE LAS OPCIONES INCORRECTAS)', est), Spacer(1, 4)]
    for i, q in enumerate(preguntas, 1):
        for o in q['options']:
            if o['id'] != q['correct']:
                h.append(Paragraph(f'<b>{i}{o["id"].upper()}.</b> {t(o["feedback"])}', est['peq']))
    h.append(Spacer(1, 8))

    h += [barra_seccion('RELACIONES QUE DEBEN APARECER EN LOS DATOS', est), Spacer(1, 4)]
    h += [Paragraph(f'• {t(par["yLabel"]).capitalize()} en función de {t(par["xLabel"])}.', est['normal']) for par in p['hypothesis']['pairs']]
    h += [Paragraph('Ecuaciones del modelo:', est['pregunta'])] + [Paragraph(f'• {t(e)}', est['normal']) for e in p['model']['equations']]
    h += [Paragraph('Supuestos:', est['pregunta'])] + [Paragraph(f'• {t(e)}', est['peq']) for e in p['model']['assumptions']]
    h += [Paragraph('Límites del modelo (para discutir con el grupo):', est['pregunta'])] + [Paragraph(f'• {t(e)}', est['peq']) for e in p['model']['limits']]
    h.append(Spacer(1, 8))

    ap = p['application']
    h += [barra_seccion('ORIENTACIONES', est), Spacer(1, 4),
          Paragraph(f'<b>Conclusión esperada:</b> {t(p["conclusionGuide"])}', est['normal']),
          Paragraph(f'<b>Aplicación en contexto:</b> {t(ap["guidance"])}', est['normal']),
          Paragraph(f'<b>Nota curricular:</b> {t(p["curricularLink"]["note"])}', est['normal']),
          Spacer(1, 6),
          Paragraph('El DBA indicado es una propuesta: verifique número y enunciado en el documento oficial del MEN y regístrelo en el panel docente '
                    '(pestaña «Validación curricular»).', est['peq'])]
    doc.build(h, onFirstPage=pie(f'Clave · {p["title"]}'), onLaterPages=pie(f'Clave · {p["title"]}'))

# ---------------------------------------------------------------- principal


def main():
    registrar_fuentes()
    est = estilos()
    with open(os.path.join(SALIDA, 'contenido.json'), encoding='utf-8') as f:
        practicas = json.load(f)
    solo = set(sys.argv[1:])
    os.makedirs(os.path.join(SALIDA, 'estudiante'), exist_ok=True)
    os.makedirs(os.path.join(SALIDA, 'docente'), exist_ok=True)
    for p in practicas:
        if solo and p['id'] not in solo:
            continue
        guia_estudiante(p, est, os.path.join(SALIDA, 'estudiante', f'guia-{p["grade"]:02d}-{p["id"]}.pdf'))
        clave_docente(p, est, os.path.join(SALIDA, 'docente', f'clave-{p["grade"]:02d}-{p["id"]}.pdf'))
        print(f'✓ {p["grade"]}.º {p["title"]}')
    if not os.path.exists(LOGO):
        print(f'Aviso: no se encontró el logo institucional ({os.path.relpath(LOGO, RAIZ)}); se usó un marcador.')


if __name__ == '__main__':
    main()
