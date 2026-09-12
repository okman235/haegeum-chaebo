# 해금 채보앱 아트보드 생성기 - 4개 .dc.html + canvas.json
import math, json, os
OUT = os.path.dirname(os.path.abspath(__file__))
W, H = 1194, 834

BG = '#0f171c'   # 먹색에 쪽빛을 섞은 바탕. 위에 보랏빛·청록빛 라디얼을 얹어 깊이를 냄
BG_GRAD = 'radial-gradient(1300px 820px at 100% 105%, rgba(40,170,165,0.34), transparent 65%), radial-gradient(1000px 640px at -5% -8%, rgba(90,120,200,0.18), transparent 60%), radial-gradient(700px 500px at 55% 45%, rgba(30,120,130,0.14), transparent 70%), #0f171c'
SURF, SURF2, LINE = 'rgba(255,255,255,0.035)', 'rgba(255,255,255,0.07)', 'rgba(255,255,255,0.10)'
TEXT, MUTED, FAINT = '#e8eef0', '#94a6ab', '#5f7378'
AMBER, AMBER_SOFT, CYAN = '#f2b45a', 'rgba(242,180,90,0.16)', '#5cc8e8'
FONT = "'IBM Plex Sans KR', system-ui, -apple-system, sans-serif"
MONO = "'IBM Plex Mono', ui-monospace, Menlo, monospace"
MUSIC = "'Noto Music', 'Apple Symbols', serif"

HEAD = f'''<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600&amp;family=IBM+Plex+Mono:wght@400;500&amp;family=Noto+Music&amp;display=swap">
  <style>
    body {{ margin: 0; background: {BG}; }}
    a {{ color: {AMBER}; }} a:hover {{ color: #ffd9a0; }}
  </style>
</helmet>
'''
TAIL = '''</x-dc>
</body>
</html>
'''

def root(inner, extra=''):
    return (f'<div style="width: {W}px; height: {H}px; background: {BG_GRAD}; color: {TEXT}; font-family: {FONT}; '
            f'font-size: 14px; line-height: 1.4; overflow: hidden; display: flex; flex-direction: column; position: relative; {extra}">\n{inner}\n</div>')

# ---------- 아이콘 (stroke 기반, 20px 그리드) ----------
def icon(name, size=20, color='currentColor', sw=1.75):
    paths = {
        'back':   '<path d="M12 4 L5 10 L12 16"></path>',
        'play':   '<path d="M6 4 L16 10 L6 16 Z" fill="currentColor" stroke="none"></path>',
        'prev':   '<path d="M14 4 L6 10 L14 16 Z" fill="currentColor" stroke="none"></path><path d="M5 4 L5 16"></path>',
        'next':   '<path d="M6 4 L14 10 L6 16 Z" fill="currentColor" stroke="none"></path><path d="M15 4 L15 16"></path>',
        'folder': '<path d="M3 6 L3 15 L17 15 L17 8 L10 8 L8 6 Z"></path>',
        'mic':    '<rect x="7" y="3" width="6" height="9" rx="3"></rect><path d="M4 10 C4 13.5 6.5 15.5 10 15.5 C13.5 15.5 16 13.5 16 10"></path><path d="M10 15.5 L10 18"></path>',
        'chev':   '<path d="M7 5 L12 10 L7 15"></path>',
        'chevd':  '<path d="M5 8 L10 13 L15 8"></path>',
        'check':  '<path d="M4 10.5 L8.5 15 L16 6"></path>',
        'export': '<path d="M10 3 L10 13"></path><path d="M6 7 L10 3 L14 7"></path><path d="M4 12 L4 17 L16 17 L16 12"></path>',
        'minus':  '<path d="M5 10 L15 10"></path>',
        'plus':   '<path d="M10 5 L10 15"></path><path d="M5 10 L15 10"></path>',
        'trash':  '<path d="M4 6 L16 6"></path><path d="M8 6 L8 4 L12 4 L12 6"></path><path d="M6 6 L6.8 16 L13.2 16 L14 6"></path>',
        'close':  '<path d="M5 5 L15 15"></path><path d="M15 5 L5 15"></path>',
        'pdf':    '<path d="M5 3 L12 3 L16 7 L16 17 L5 17 Z"></path><path d="M12 3 L12 7 L16 7"></path>',
        'xml':    '<path d="M7 6 L3 10 L7 14"></path><path d="M13 6 L17 10 L13 14"></path>',
        'midi':   '<rect x="3" y="5" width="14" height="10" rx="2"></rect><path d="M6.5 5 L6.5 11"></path><path d="M10 5 L10 11"></path><path d="M13.5 5 L13.5 11"></path>',
        'image':  '<rect x="3" y="4" width="14" height="12" rx="1.5"></rect><path d="M3 13 L8 9 L11 12 L13 10.5 L17 14"></path>',
    }
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 20 20" fill="none" stroke="{color}" stroke-width="{sw}" '
            f'stroke-linecap="round" stroke-linejoin="round" style="display: block; flex-shrink: 0;">{paths[name]}</svg>')

# ---------- 곡선 데이터 (진양조 느낌의 느린 선율, 시김새 포함) ----------
# (midi, dur_s, ornament)  ornament: None | 'nong' 농현 | 'toe' 퇴성 | 'chu' 추성
NOTES = [(64, 1.6, 'nong'), (62, 0.9, None), (60, 1.4, 'toe'), (57, 1.5, 'nong'),
         (60, 0.8, 'chu'), (62, 1.2, None), (64, 2.0, 'nong'), (62, 0.6, None), (60, 1.1, 'toe')]
SELECTED = 6
GAP = 0.06
TOTAL = sum(d for _, d, _ in NOTES) + GAP * (len(NOTES) - 1)

def f0_samples(step=0.02):
    t = 0.0; out = []; segs = []
    for i, (m, d, orn) in enumerate(NOTES):
        t0 = t; pts = []
        n = int(d / step)
        for k in range(n + 1):
            tt = k * step; frac = tt / d
            v = float(m)
            if orn == 'nong' and tt > 0.25:
                env = min(1.0, (tt - 0.25) / 0.4)
                v += 0.42 * env * math.sin(2 * math.pi * 5.2 * (tt - 0.25))
            if orn == 'toe' and tt > d - 0.28:
                v -= 1.6 * ((tt - (d - 0.28)) / 0.28) ** 1.6
            if orn == 'chu' and tt < 0.22:
                v -= 1.1 * (1 - tt / 0.22) ** 1.4
            v += 0.03 * math.sin(2 * math.pi * 1.7 * (t0 + tt)) + 0.02 * math.sin(17.3 * (t0 + tt))
            pts.append((t0 + tt, v))
        out.append(pts); segs.append((t0, t0 + d, m, orn, i))
        t = t0 + d + GAP
    return out, segs

# ---------- 곡선 뷰 (SVG) ----------
def curve_view(w=894, h=340):
    gut, top, bottom = 56, 22, h - 84   # 곡선 영역 y 범위, 아래에 파형(36)+눈금(28)
    mid_lo, mid_hi = 55, 67             # G3 .. G4
    def y_of(m): return bottom - (m - mid_lo) / (mid_hi - mid_lo) * (bottom - top)
    def x_of(t): return gut + t / TOTAL * (w - gut - 16)
    names = {55:'G3',57:'A3',59:'B3',60:'C4',62:'D4',64:'E4',65:'F4',67:'G4'}
    s = [f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" style="display: block;">']
    # 반음 격자
    for m in range(mid_lo, mid_hi + 1):
        y = y_of(m); nat = m in names
        s.append(f'<line x1="{gut}" y1="{y:.1f}" x2="{w}" y2="{y:.1f}" stroke="{LINE if nat else "#1a262c"}" stroke-width="1"></line>')
        if nat:
            s.append(f'<text x="{gut-10}" y="{y+4:.1f}" text-anchor="end" font-family="{MONO}" font-size="11" fill="{MUTED}">{names[m]}</text>')
    curves, segs = f0_samples()
    # 노트 구간 블록
    for (t0, t1, m, orn, i) in segs:
        yy = y_of(m + 0.5); hh = y_of(m - 0.5) - yy
        sel = i == SELECTED
        s.append(f'<rect x="{x_of(t0):.1f}" y="{yy:.1f}" width="{x_of(t1)-x_of(t0):.1f}" height="{hh:.1f}" rx="3" '
                 f'fill="{"rgba(92,200,232,0.14)" if sel else AMBER_SOFT}" stroke="{CYAN if sel else "none"}" stroke-width="1.5"></rect>')
        # 시김새 표시
        cx = (x_of(t0) + x_of(t1)) / 2; ty = yy - 10
        if orn == 'nong':
            x0 = x_of(t0) + 8; x1 = x_of(t1) - 8; d = f'M{x0:.1f} {ty:.1f}'
            xx = x0; up = True
            while xx + 6 < x1:
                d += f' q3 {-4 if up else 4} 6 0'; xx += 6; up = not up
            s.append(f'<path d="{d}" fill="none" stroke="{AMBER}" stroke-width="1.5" opacity="0.9"></path>')
        elif orn == 'toe':
            ex = x_of(t1) - 6
            s.append(f'<path d="M{ex-16:.1f} {ty-6:.1f} L{ex:.1f} {ty+4:.1f} M{ex-6:.1f} {ty+3:.1f} L{ex:.1f} {ty+4:.1f} L{ex-1:.1f} {ty-2:.1f}" fill="none" stroke="{AMBER}" stroke-width="1.5"></path>')
        elif orn == 'chu':
            bx = x_of(t0) + 6
            s.append(f'<path d="M{bx:.1f} {ty+4:.1f} L{bx+16:.1f} {ty-6:.1f} M{bx+10:.1f} {ty-7:.1f} L{bx+16:.1f} {ty-6:.1f} L{bx+15:.1f} {ty:.1f}" fill="none" stroke="{AMBER}" stroke-width="1.5"></path>')
    # f0 곡선 (글로우 + 본선)
    d = ''
    for pts in curves:
        d += ' M' + ' L'.join(f'{x_of(t):.1f} {y_of(v):.1f}' for t, v in pts)
    s.append(f'<path d="{d.strip()}" fill="none" stroke="{AMBER}" stroke-width="7" opacity="0.14" stroke-linecap="round"></path>')
    s.append(f'<path d="{d.strip()}" fill="none" stroke="{AMBER}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>')
    # 파형 띠
    wy = bottom + 14
    for i in range(gut, w - 16, 4):
        t = (i - gut) / (w - gut - 16) * TOTAL
        a = 0.35 + 0.65 * abs(math.sin(t * 2.1) * math.cos(t * 0.7 + 1.2)) * (0.6 + 0.4 * math.sin(t * 9.1))
        hh = 3 + 26 * a
        s.append(f'<rect x="{i}" y="{wy + 18 - hh/2:.1f}" width="2.5" height="{hh:.1f}" fill="#38505a"></rect>')
    # 박 눈금 (진양조 - 한 박이 느림)
    ry = h - 24; beat = TOTAL / 6
    s.append(f'<line x1="{gut}" y1="{ry}" x2="{w}" y2="{ry}" stroke="{LINE}"></line>')
    for b in range(7):
        x = x_of(b * beat)
        s.append(f'<line x1="{x:.1f}" y1="{ry}" x2="{x:.1f}" y2="{ry+6}" stroke="{MUTED}"></line>')
        if b < 6:
            s.append(f'<text x="{x+6:.1f}" y="{ry+18}" font-family="{MONO}" font-size="11" fill="{MUTED}">{b+1}박</text>')
    # 재생 헤드
    px = x_of(4.3)
    s.append(f'<line x1="{px:.1f}" y1="{top-8}" x2="{px:.1f}" y2="{h-24}" stroke="{CYAN}" stroke-width="1.5"></line>')
    s.append(f'<path d="M{px-5:.1f} {top-10} L{px+5:.1f} {top-10} L{px:.1f} {top-2} Z" fill="{CYAN}"></path>')
    s.append('</svg>')
    return '\n'.join(s)

# ---------- 오선보 뷰 (SVG) ----------
def score_view(w=894, h=438):
    s = [f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" style="display: block;">']
    sy = 214; sp = 10                       # 첫째 줄(아래) y, 줄 간격
    left, right = 92, w - 40
    for i in range(5):
        y = sy - i * sp
        s.append(f'<line x1="{left-52}" y1="{y}" x2="{right}" y2="{y}" stroke="{MUTED}" stroke-width="1"></line>')
    # 높은음자리표 + 박자표
    s.append(f'<text x="{left-48}" y="{sy+13}" font-family="{MUSIC}" font-size="64" fill="{TEXT}">&#x1D11E;</text>')
    s.append(f'<text x="{left+2}" y="{sy-21}" font-family="{MONO}" font-size="20" font-weight="500" fill="{TEXT}">18</text>')
    s.append(f'<text x="{left+7}" y="{sy-1}" font-family="{MONO}" font-size="20" font-weight="500" fill="{TEXT}">8</text>')
    # 마디
    x0 = left + 40; bar_x = x0 + 5 * 84 - 18
    for bx, num in ((x0 - 10, 1), (bar_x, 2)):
        s.append(f'<line x1="{bx}" y1="{sy-40}" x2="{bx}" y2="{sy}" stroke="{MUTED}" stroke-width="1.2"></line>')
        s.append(f'<text x="{bx}" y="{sy-58}" font-family="{MONO}" font-size="11" fill="{FAINT}">{num}</text>')
    s.append(f'<line x1="{right}" y1="{sy-40}" x2="{right}" y2="{sy}" stroke="{MUTED}" stroke-width="1.2"></line>')
    steps = {64: 0, 62: -1, 60: -2, 59: -3, 57: -4, 55: -5}
    x = x0
    for i, (m, d, orn) in enumerate(NOTES):
        if i == 5: x = bar_x + 30
        st = steps[m]; y = sy - st * (sp / 2)
        sel = i == SELECTED; col = CYAN if sel else TEXT
        # 덧줄
        for ls in (-2, -4):
            if st <= ls:
                yy = sy - ls * (sp / 2)
                s.append(f'<line x1="{x-11}" y1="{yy}" x2="{x+11}" y2="{yy}" stroke="{MUTED}" stroke-width="1"></line>')
        if sel:
            s.append(f'<circle cx="{x}" cy="{y}" r="14" fill="rgba(92,200,232,0.16)"></circle>')
        s.append(f'<ellipse cx="{x}" cy="{y}" rx="6.2" ry="4.3" transform="rotate(-20 {x} {y})" fill="{col}"></ellipse>')
        s.append(f'<line x1="{x+5.6}" y1="{y-1}" x2="{x+5.6}" y2="{y-32}" stroke="{col}" stroke-width="1.4"></line>')
        if d >= 1.4:  # 점음표
            s.append(f'<circle cx="{x+12}" cy="{y-3 if st % 2 == 0 else y}" r="1.8" fill="{col}"></circle>')
        oy = y - 44
        if orn == 'nong':
            dd = f'M{x-12} {oy}'; xx = x - 12; up = True
            for _ in range(4):
                dd += f' q3 {-4 if up else 4} 6 0'; up = not up
            s.append(f'<path d="{dd}" fill="none" stroke="{AMBER}" stroke-width="1.6"></path>')
        elif orn == 'toe':
            s.append(f'<path d="M{x+2} {oy-6} L{x+16} {oy+4} M{x+10} {oy+4} L{x+16} {oy+4} L{x+15} {oy-2}" fill="none" stroke="{AMBER}" stroke-width="1.6"></path>')
        elif orn == 'chu':
            s.append(f'<path d="M{x-16} {oy+4} L{x-2} {oy-6} M{x-8} {oy-7} L{x-2} {oy-6} L{x-3} {oy}" fill="none" stroke="{AMBER}" stroke-width="1.6"></path>')
        x += 84
    # 기호 설명
    ly = h - 26
    s.append(f'<path d="M{left-40} {ly} q3 -4 6 0 q3 4 6 0 q3 -4 6 0 q3 4 6 0" fill="none" stroke="{AMBER}" stroke-width="1.6"></path>')
    s.append(f'<text x="{left-8}" y="{ly+4}" font-size="12" fill="{MUTED}">농현</text>')
    s.append(f'<path d="M{left+44} {ly+5} L{left+58} {ly-5} M{left+52} {ly-6} L{left+58} {ly-5} L{left+57} {ly+1}" fill="none" stroke="{AMBER}" stroke-width="1.6"></path>')
    s.append(f'<text x="{left+66}" y="{ly+4}" font-size="12" fill="{MUTED}">추성</text>')
    s.append(f'<path d="M{left+118} {ly-5} L{left+132} {ly+5} M{left+126} {ly+5} L{left+132} {ly+5} L{left+131} {ly-1}" fill="none" stroke="{AMBER}" stroke-width="1.6"></path>')
    s.append(f'<text x="{left+140}" y="{ly+4}" font-size="12" fill="{MUTED}">퇴성</text>')
    s.append('</svg>')
    return '\n'.join(s)

# ---------- 공용 조각 ----------
def chip(text, tone='muted'):
    if tone == 'amber':
        return f'<span style="display: inline-flex; align-items: center; height: 28px; padding: 0 10px; border-radius: 6px; background: {AMBER_SOFT}; color: {AMBER}; font-size: 12px; font-weight: 500;">{text}</span>'
    return f'<span style="display: inline-flex; align-items: center; height: 28px; padding: 0 10px; border-radius: 6px; background: {SURF2}; color: {MUTED}; font-size: 12px; font-family: {MONO};">{text}</span>'

def button(text, kind='primary', ic=None, width=None):
    base = f'display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 44px; padding: 0 18px; border-radius: 8px; font-size: 14px; font-weight: 500; {"width: %s;" % width if width else ""}'
    if kind == 'primary':   st = base + f'background: {AMBER}; color: #1a1408;'
    elif kind == 'secondary': st = base + f'background: {SURF2}; color: {TEXT}; border: 1px solid {LINE};'
    else:                   st = base + f'background: transparent; color: {MUTED};'
    return f'<div style="{st}">{icon(ic, 18) if ic else ""}<span>{text}</span></div>'

def topbar(title, chips, right_html):
    return (f'<div style="height: 56px; flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding: 0 16px 0 12px; border-bottom: 1px solid {LINE}; background: {SURF};">'
            f'<div style="display: flex; align-items: center; gap: 12px;">'
            f'<div style="width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; color: {MUTED};">{icon("back")}</div>'
            f'<span style="font-size: 15px; font-weight: 600;">{title}</span>{"".join(chips)}</div>'
            f'<div style="display: flex; align-items: center; gap: 14px;">'
            f'<div style="color: {MUTED}">{icon("prev", 22)}</div>'
            f'<div style="width: 40px; height: 40px; border-radius: 20px; background: {AMBER}; color: #1a1408; display: flex; align-items: center; justify-content: center;">{icon("play", 22)}</div>'
            f'<div style="color: {MUTED}">{icon("next", 22)}</div>'
            f'<span style="font-family: {MONO}; font-size: 13px; color: {TEXT}; margin-left: 4px;">00:04.3</span>'
            f'<span style="font-family: {MONO}; font-size: 13px; color: {FAINT};">/ 04:18.0</span></div>'
            f'<div style="display: flex; align-items: center; gap: 10px;">{right_html}</div></div>')

# ---------- 아트보드 1: 시작 ----------
def start():
    def row(label, value):
        return (f'<div style="display: flex; align-items: center; justify-content: space-between; height: 48px; border-bottom: 1px solid {LINE};">'
                f'<span style="color: {MUTED}; font-size: 13px;">{label}</span>'
                f'<div style="display: flex; align-items: center; gap: 6px; color: {TEXT}; font-size: 14px; font-weight: 500;"><span>{value}</span><span style="color: {FAINT}">{icon("chevd", 16)}</span></div></div>')
    def spark(seed):
        pts = []
        for i in range(0, 97, 4):
            t = i / 96 * 6.28
            v = 20 + 9 * math.sin(t * 1.3 + seed) + 3 * math.sin(t * 7 + seed * 2)
            pts.append(f'{i} {v:.1f}')
        return f'<svg width="96" height="40" viewBox="0 0 96 40" style="display: block;"><path d="M{" L".join(pts)}" fill="none" stroke="{AMBER}" stroke-width="1.6" opacity="0.85"></path></svg>'
    def recent(name, meta, date, seed):
        return (f'<div style="display: flex; align-items: center; gap: 18px; height: 76px; border-bottom: 1px solid {LINE};">'
                f'<div style="width: 96px; height: 40px; border-radius: 6px; background: {SURF2}; overflow: hidden;">{spark(seed)}</div>'
                f'<div style="display: flex; flex-direction: column; gap: 4px; flex-grow: 1;"><span style="font-size: 15px; font-weight: 500;">{name}</span>'
                f'<span style="font-size: 12px; color: {MUTED}; font-family: {MONO};">{meta}</span></div>'
                f'<span style="font-size: 12px; color: {FAINT};">{date}</span></div>')
    left = (f'<div style="width: 440px; flex-shrink: 0; padding: 52px 48px 40px 48px; display: flex; flex-direction: column; gap: 28px; border-right: 1px solid {LINE}; background: {SURF};">'
            f'<div style="display: flex; flex-direction: column; gap: 10px;"><span style="font-size: 26px; font-weight: 600; letter-spacing: -0.01em;">해금 채보</span>'
            f'<span style="font-size: 14px; color: {MUTED}; line-height: 1.55;">녹음이나 강의 영상을 열면 바로 분석이 시작됩니다. 유튜브 영상은 화면 녹화 파일로 열 수 있습니다.</span></div>'
            f'<div style="display: flex; flex-direction: column; gap: 10px;">{button("녹음·영상 파일 열기", "primary", "folder", "100%").replace("height: 44px", "height: 56px").replace("font-size: 14px", "font-size: 16px")}'
            f'{button("마이크로 녹음", "secondary", "mic", "100%").replace("height: 44px", "height: 56px").replace("font-size: 14px", "font-size: 16px")}</div>'
            f'<div style="flex-grow: 1;"></div>'
            f'<span style="font-size: 12px; color: {FAINT}; line-height: 1.5;">녹음은 이 기기 안에서만 처리되고 어디로도 전송되지 않습니다.</span></div>')
    right = (f'<div style="flex-grow: 1; padding: 52px 56px; display: flex; flex-direction: column; gap: 8px;">'
             f'<span style="font-size: 13px; color: {MUTED}; margin-bottom: 8px;">최근 프로젝트</span>'
             f'{recent("진양조 연습 09-12", "진양조 · 4:18", "9월 12일", 0.4)}'
             f'{recent("자진모리 첫 장단", "자진모리 · 1:52", "9월 10일", 2.1)}'
             f'{recent("중모리 시김새 구간", "중모리 · 0:47", "9월 6일", 4.7)}</div>')
    return HEAD + root(f'<div style="display: flex; flex-grow: 1;">{left}{right}</div>') + TAIL

# ---------- 아트보드 2: 분석 중 ----------
def analyzing():
    prog = 0.62; ww = 760
    bars = []
    for i in range(0, ww, 4):
        t = i / ww * 40
        a = 0.3 + 0.7 * abs(math.sin(t * 1.9) * math.cos(t * 0.6 + 0.8)) * (0.55 + 0.45 * math.sin(t * 8.3))
        hh = 3 + 50 * a
        col = AMBER if i < ww * prog else '#28393f'
        bars.append(f'<rect x="{i}" y="{32 - hh/2:.1f}" width="2.5" height="{hh:.1f}" fill="{col}"></rect>')
    px = ww * prog
    bars.append(f'<line x1="{px:.1f}" y1="0" x2="{px:.1f}" y2="64" stroke="{CYAN}" stroke-width="1.5"></line>')
    wave = f'<svg width="{ww}" height="64" viewBox="0 0 {ww} 64" style="display: block;">{"".join(bars)}</svg>'
    def stage(label, state):
        if state == 'done':
            mark = f'<div style="width: 22px; height: 22px; border-radius: 11px; background: {AMBER_SOFT}; color: {AMBER}; display: flex; align-items: center; justify-content: center;">{icon("check", 14, sw=2.2)}</div>'; col = MUTED
        elif state == 'active':
            mark = f'<div style="width: 22px; height: 22px; border-radius: 11px; border: 2px solid {AMBER}; display: flex; align-items: center; justify-content: center;"><div style="width: 8px; height: 8px; border-radius: 4px; background: {AMBER};"></div></div>'; col = TEXT
        else:
            mark = f'<div style="width: 22px; height: 22px; border-radius: 11px; border: 1.5px solid {LINE};"></div>'; col = FAINT
        return f'<div style="display: flex; align-items: center; gap: 12px;">{mark}<span style="font-size: 14px; color: {col}; font-weight: {"500" if state == "active" else "400"};">{label}</span></div>'
    inner = (f'<div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 36px;">'
             f'<div style="display: flex; flex-direction: column; align-items: center; gap: 6px;"><span style="font-size: 20px; font-weight: 600;">진양조 연습 09-12.m4a</span>'
             f'<span style="font-size: 13px; color: {MUTED}; font-family: {MONO};">4:18 · 44.1 kHz</span></div>'
             f'<div style="display: flex; flex-direction: column; gap: 14px; align-items: center;">{wave}'
             f'<div style="display: flex; gap: 16px; align-items: baseline;"><span style="font-size: 15px; font-weight: 500;">음높이 추적 중</span>'
             f'<span style="font-family: {MONO}; font-size: 15px; color: {AMBER};">62%</span><span style="font-size: 13px; color: {FAINT};">약 20초 남음</span></div></div>'
             f'<div style="display: flex; gap: 36px;">{stage("디코딩", "done")}{stage("음높이 추적", "active")}{stage("음 분할", "todo")}{stage("시김새 감지", "todo")}{stage("악보 배치", "todo")}</div>'
             f'{button("취소", "ghost")}</div>')
    return HEAD + root(inner) + TAIL

# ---------- 아트보드 3: 채보 (메인) ----------
def toggle(label, on):
    st = (f'display: flex; align-items: center; justify-content: center; height: 44px; border-radius: 8px; font-size: 14px; font-weight: 500; '
          + (f'background: {AMBER_SOFT}; color: {AMBER}; border: 1px solid rgba(242,180,90,0.5);' if on else f'background: transparent; color: {MUTED}; border: 1px solid {LINE};'))
    return f'<div style="{st}">{label}</div>'

def slider(label, value, unit, frac):
    return (f'<div style="display: flex; flex-direction: column; gap: 10px;">'
            f'<div style="display: flex; justify-content: space-between;"><span style="font-size: 13px; color: {MUTED};">{label}</span>'
            f'<span style="font-family: {MONO}; font-size: 13px; color: {TEXT};">{value} {unit}</span></div>'
            f'<div style="position: relative; height: 24px;"><div style="position: absolute; left: 0; right: 0; top: 11px; height: 2px; background: {LINE};"></div>'
            f'<div style="position: absolute; left: 0; width: {frac*100:.0f}%; top: 11px; height: 2px; background: {AMBER};"></div>'
            f'<div style="position: absolute; left: calc({frac*100:.0f}% - 9px); top: 3px; width: 18px; height: 18px; border-radius: 9px; background: {TEXT};"></div></div></div>')

def stepper(big, small):
    return (f'<div style="display: flex; align-items: center; justify-content: space-between;">'
            f'<div style="display: flex; flex-direction: column; gap: 2px;"><span style="font-family: {MONO}; font-size: 28px; font-weight: 500; line-height: 1;">{big}</span>'
            f'<span style="font-size: 12px; color: {FAINT};">{small}</span></div>'
            f'<div style="display: flex; gap: 8px;"><div style="width: 44px; height: 44px; border-radius: 8px; border: 1px solid {LINE}; display: flex; align-items: center; justify-content: center; color: {TEXT};">{icon("minus")}</div>'
            f'<div style="width: 44px; height: 44px; border-radius: 8px; border: 1px solid {LINE}; display: flex; align-items: center; justify-content: center; color: {TEXT};">{icon("plus")}</div></div></div>')

def main():
    dur_big = '<span style="font-family: ' + MUSIC + '">&#x1D15F;.</span>'
    bar = topbar('진양조 연습 09-12', [chip('진양조 18/8'), chip('한 박 = 36')],
                 chip('산조', 'amber') + button('내보내기', 'primary', 'export').replace('height: 44px', 'height: 38px').replace('padding: 0 18px', 'padding: 0 14px'))
    leftcol = (f'<div style="flex-grow: 1; display: flex; flex-direction: column; min-width: 0;">'
               f'<div style="height: 340px; flex-shrink: 0; border-bottom: 1px solid {LINE};">{curve_view()}</div>'
               f'<div style="flex-grow: 1; background: {SURF};">{score_view()}</div></div>')
    panel = (f'<div style="width: 300px; flex-shrink: 0; border-left: 1px solid {LINE}; background: {SURF}; padding: 20px 20px 16px 20px; display: flex; flex-direction: column; gap: 22px;">'
             f'<div style="display: flex; justify-content: space-between; align-items: baseline;"><span style="font-size: 15px; font-weight: 600;">선택 음표</span><span style="font-size: 12px; color: {FAINT}; font-family: {MONO};">2마디 2번째</span></div>'
             f'<div style="display: flex; flex-direction: column; gap: 8px;"><span style="font-size: 12px; color: {FAINT};">음정</span>{stepper("E4", "실제 소리 +9센트")}</div>'
             f'<div style="display: flex; flex-direction: column; gap: 8px;"><span style="font-size: 12px; color: {FAINT};">길이</span>{stepper(dur_big, "점4분음표 · 2.0초")}</div>'
             f'<div style="display: flex; flex-direction: column; gap: 8px;"><span style="font-size: 12px; color: {FAINT};">시김새</span>'
             f'<div style="display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px;">{toggle("농현", True)}{toggle("추성", False)}{toggle("퇴성", False)}{toggle("전성", False)}</div></div>'
             f'<div style="display: flex; flex-direction: column; gap: 16px;"><span style="font-size: 12px; color: {FAINT};">자동 감지 기준</span>{slider("농현으로 볼 흔들림", "30", "센트 이상", 0.3)}{slider("추성·퇴성으로 볼 미끄러짐", "60", "센트 이상", 0.5)}</div>'
             f'<div style="flex-grow: 1;"></div>'
             f'<div style="display: flex; gap: 8px;">{button("구간 재생", "secondary", "play", "100%")}<div style="width: 44px; height: 44px; border-radius: 8px; border: 1px solid {LINE}; display: flex; align-items: center; justify-content: center; color: {MUTED}; flex-shrink: 0;">{icon("trash")}</div></div></div>')
    return HEAD + root(bar + f'<div style="display: flex; flex-grow: 1; min-height: 0;">{leftcol}{panel}</div>') + TAIL

# ---------- 아트보드 4: 내보내기 ----------
def export():
    bar = topbar('진양조 연습 09-12', [chip('진양조 18/8'), chip('한 박 = 36')],
                 chip('산조', 'amber') + button('내보내기', 'primary', 'export').replace('height: 44px', 'height: 38px').replace('padding: 0 18px', 'padding: 0 14px'))
    backdrop = (f'<div style="display: flex; flex-grow: 1; min-height: 0;"><div style="flex-grow: 1; display: flex; flex-direction: column;">'
                f'<div style="height: 340px; border-bottom: 1px solid {LINE};">{curve_view()}</div><div style="flex-grow: 1; background: {SURF};">{score_view()}</div></div>'
                f'<div style="width: 300px; border-left: 1px solid {LINE}; background: {SURF};"></div></div>')
    def opt(ic, title, desc, on):
        return (f'<div style="display: flex; align-items: center; gap: 14px; height: 64px; padding: 0 16px; border-radius: 10px; '
                f'{"background: " + AMBER_SOFT + "; border: 1px solid rgba(242,180,90,0.5);" if on else "border: 1px solid " + LINE + ";"}">'
                f'<div style="color: {AMBER if on else MUTED};">{icon(ic, 22)}</div>'
                f'<div style="display: flex; flex-direction: column; gap: 2px; flex-grow: 1;"><span style="font-size: 15px; font-weight: 500; color: {TEXT};">{title}</span><span style="font-size: 12px; color: {MUTED};">{desc}</span></div>'
                f'<div style="width: 20px; height: 20px; border-radius: 10px; {"background: " + AMBER + "; color: #1a1408; display: flex; align-items: center; justify-content: center;" if on else "border: 1.5px solid " + LINE + ";"}">{icon("check", 13, sw=2.4) if on else ""}</div></div>')
    def setting(label, value):
        return (f'<div style="display: flex; align-items: center; justify-content: space-between; height: 44px;"><span style="font-size: 13px; color: {MUTED};">{label}</span>'
                f'<div style="display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 500;"><span>{value}</span><span style="color: {FAINT}">{icon("chevd", 16)}</span></div></div>')
    sheet = (f'<div style="position: absolute; inset: 0; background: rgba(8,10,14,0.62); display: flex; align-items: center; justify-content: center;">'
             f'<div style="width: 560px; background: {SURF}; border: 1px solid {LINE}; border-radius: 16px; padding: 24px 24px 20px 24px; display: flex; flex-direction: column; gap: 18px; box-shadow: 0 24px 64px rgba(0,0,0,0.5);">'
             f'<div style="display: flex; align-items: center; justify-content: space-between;"><span style="font-size: 18px; font-weight: 600;">내보내기</span><div style="color: {MUTED};">{icon("close")}</div></div>'
             f'<div style="display: flex; flex-direction: column; gap: 8px;">'
             f'{opt("pdf", "PDF 악보", "교재와 인쇄용. 시김새 기호가 함께 들어갑니다.", True)}'
             f'{opt("xml", "MusicXML", "MuseScore 등에서 이어서 편집할 때", False)}'
             f'{opt("midi", "MIDI", "다른 음악 프로그램에서 소리로 들을 때", False)}'
             f'{opt("image", "곡선 이미지 (PNG)", "시김새를 설명할 때 곡선만 따로", False)}</div>'
             f'<div style="display: flex; flex-direction: column; border-top: 1px solid {LINE}; padding-top: 6px;">{setting("용지", "A4 세로")}{setting("제목과 장단 표시", "켬")}</div>'
             f'<div style="display: flex; justify-content: flex-end; gap: 8px;">{button("취소", "ghost")}{button("PDF로 내보내기", "primary", "export")}</div></div></div>')
    return HEAD + root(bar + backdrop + sheet) + TAIL

files = {'Start.dc.html': start(), 'Analyzing.dc.html': analyzing(), 'Main.dc.html': main(), 'Export.dc.html': export()}
for name, html in files.items():
    open(os.path.join(OUT, name), 'w', encoding='utf-8').write(html)
    print(f'{name}: {len(html)} chars')
canvas = {
    "artboards": [
        {"file": "Start.dc.html",     "title": "1 시작",    "x": 0,    "y": 0, "w": W, "h": H},
        {"file": "Analyzing.dc.html", "title": "2 분석 중", "x": 1280, "y": 0, "w": W, "h": H},
        {"file": "Main.dc.html",      "title": "3 채보",    "x": 2560, "y": 0, "w": W, "h": H},
        {"file": "Export.dc.html",    "title": "4 내보내기", "x": 3840, "y": 0, "w": W, "h": H},
    ],
    "annotations": [
        {"id": "brief", "x": 0, "y": -220, "w": 520,
         "text": "해금 채보앱 화면 목업 v1\n아이패드 가로 1194×834, 다크 스튜디오 톤, 정적 목업\n흐름: 시작 → 분석 중 → 채보(곡선+오선보+편집) → 내보내기\n곡선·음표·시김새 기호는 예시 데이터"}
    ],
    "launch": {"view": "canvas"}
}
json.dump(canvas, open(os.path.join(OUT, 'canvas.json'), 'w'), ensure_ascii=False, indent=2)
print('canvas.json written')
