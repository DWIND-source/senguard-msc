"""End-to-end test: drives the real app in Microsoft Edge the way a user would.
Usage: python site/test/e2e.py BASE_URL [--offline] [--shots DIR]   (needs playwright; uses the installed Edge)"""
import csv, gzip, io, json, sys, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip('/') + '/'
OFFLINE = '--offline' in sys.argv
SHOTS = Path(sys.argv[sys.argv.index('--shots') + 1]) if '--shots' in sys.argv else None
ROOT = Path(__file__).resolve().parents[2]
results = []
def check(name, ok, detail=''):
    results.append(bool(ok))
    print(f"{'PASS' if ok else 'FAIL'}  {name}  {str(detail)[:120]}")

def wait_head(page, text, timeout=60000):
    page.wait_for_function("t => document.getElementById('in-headline').textContent.includes(t)", arg=text, timeout=timeout)

# A realistic lab table: gene symbols as ids and readable sample names
table = gzip.decompress((ROOT / 'site/data/adipose_msc_counts.tsv.gz').read_bytes()).decode().splitlines()
sheet = list(csv.DictReader((ROOT / 'site/data/adipose_msc_samples.csv').read_text().splitlines()))
sym = json.loads(gzip.decompress((ROOT / 'site/data/symbol_to_ensembl.json.gz').read_bytes()))
ens2sym = {e: s for s, e in sym.items()}
names = {r['sample_id']: f"{r['donor']}_p{int(float(r['passage']))}" for r in sheet}
head = table[0].split('\t')
new_head = '\t'.join(['gene'] + [names.get(c, c) for c in head[1:]])
rows = [new_head]
for l in table[1:]:
    i = l.index('\t')
    rows.append(ens2sym.get(l[:i], l[:i]) + l[i:])
tmp = Path(tempfile.mkdtemp())
lab_table = tmp / 'my_lab_counts.tsv'
lab_table.write_text('\n'.join(rows), encoding='utf-8')
unclear = tmp / 'unclear_names.tsv'
unclear.write_text('\n'.join(table), encoding='utf-8')

with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True, args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    ctx = browser.new_context(viewport={'width': 1320, 'height': 1000}, accept_downloads=True)
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' and 'favicon' not in m.text else None)

    page.goto(BASE, wait_until='load')
    wait_head(page, 'Score rose in 5 of 5')
    check('Default example builds a twin', True, page.inner_text('#in-sub'))
    check('3D canvas is present', page.locator('#canvas canvas').count() == 1)
    check('All checks are shown', page.locator('#rail li').count() >= 7)
    check('Boilerplate sections are gone', page.locator('#limits').count() == 0 and page.locator('footer').count() == 0)
    check('Demo leads with visual atlas', 'expression atlas' in page.inner_text('.hero .kicker'))
    check('Forecast table is filled', page.locator('#plan-rows tr').count() == 5)

    # Plain-language additions: reading line, donor flags, colour key, culture options, qPCR panel, IFN-γ, language switch
    page.wait_for_selector('#panel-body .gene-table')
    check('Chart has a one-line reading', 'aging score' in page.inner_text('#reading-line') and 'keep or discard' in page.inner_text('#reading-line'), page.inner_text('#reading-line')[:90])
    check('Every donor carries a flag', page.locator('#results .panel .flag').count() == 5, page.locator('#results .panel .flag').first.inner_text())
    check('Heatmap colours are explained as z-scores', 'not temperature' in page.inner_text('.heat-key'))
    proc = page.inner_text('#process-body')
    check('Cell-bank example uses GSE269586', '9 of 11' in proc and 'not a sign of poor quality' in proc)
    check('Score-lowering answer is an observation, not a goal', '3.5 lower' in proc and 'not a treatment goal' in proc)
    check('qPCR panel lists 20 genes and flags 4', page.locator('#panel-body .gene-table tbody tr').count() == 20 and page.locator('#panel-body tr.flagged').count() == 4)
    check('IFN-γ section keeps the GVHD result', 'p = 0.625' in page.inner_text('#immune-body') and 'research direction' in page.inner_text('#immune-body'))
    check('p16–CDK6 view is marked as background', 'not calculated from your data' in page.inner_text('#molecular'))
    page.click('#lang-toggle')
    page.wait_for_timeout(400)
    check('Vietnamese switch translates the page and keeps the result', page.evaluate('document.documentElement.lang') == 'vi' and 'Điểm tăng ở 5/5' in page.inner_text('#in-headline') and 'Người hiến' in page.inner_text('#results'), page.inner_text('#in-headline'))
    page.click('#lang-toggle')
    page.wait_for_timeout(400)
    check('Switching back restores English', 'Score rose in 5 of 5' in page.inner_text('#in-headline') and 'Culture twin' in page.inner_text('nav'))
    page.wait_for_timeout(1500)
    pixels = page.evaluate("""() => { const c = document.querySelector('#canvas canvas'); const g = c.getContext('webgl2') || c.getContext('webgl'); const b = new Uint8Array(4 * c.width * c.height); g.readPixels(0, 0, c.width, c.height, g.RGBA, g.UNSIGNED_BYTE, b); let n = 0; for (let i = 3; i < b.length; i += 4) if (b[i] > 0) n++; return n / (c.width * c.height); }""")
    check('The 3D scene actually draws', pixels > 0.005, f'{pixels:.1%} of the canvas')

    before = page.locator('#plan-rows tr').first.text_content()
    page.fill('#plan-p', '5')
    after = page.locator('#plan-rows tr').first.text_content()
    check('Expansion planner responds to the target passage', before != after, after.replace('\t', ' '))

    for bid, view in [('#v-land', 'Score landscape'), ('#v-space', 'Expression space'), ('#v-fore', 'Forecast')]:
        page.click(bid)
        page.wait_for_timeout(300)
        check(f'View button works: {view}', page.get_attribute(bid, 'aria-pressed') == 'true')
    page.wait_for_timeout(1300)
    if SHOTS:
        page.screenshot(path=str(SHOTS / 'e2e_forecast.png'))

    page.click('#donors button[data-d="C"]')
    page.wait_for_timeout(300)
    check('Donor chip opens that donor\'s record', 'C' in page.inner_text('#record .meta'), page.inner_text('#record .meta').replace('\n', ' ')[:60])
    page.click('#donors button[data-d=""]')
    pos = page.evaluate("""() => { const t = window.__twin; const n = t.nodes.find((x) => x.mesh.visible && x.donor === 'E'); const v = n.mesh.position.clone().project(t.camera); const r = t.renderer.domElement.getBoundingClientRect(); return { id: n.point.id, x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; }""")
    page.evaluate("() => { window.__twin.controls.autoRotate = false; }")
    page.wait_for_timeout(400)
    pos = page.evaluate("""() => { const t = window.__twin; const n = t.nodes.filter((x) => x.mesh.visible && x.donor === 'E').pop(); const v = n.mesh.position.clone().project(t.camera); const r = t.renderer.domElement.getBoundingClientRect(); return { id: n.point.id, x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; }""")
    page.mouse.click(pos['x'], pos['y'])
    page.wait_for_timeout(300)
    rec = page.inner_text('#record')
    check('Clicking a sphere opens its sample record', 'Sample record' in rec and ('E' in rec), pos['id'])

    page.click('#play')
    page.wait_for_timeout(1000)
    moved = page.input_value('#slider')
    page.wait_for_timeout(9000)
    check('Play walks through the passages', int(page.input_value('#slider')) == int(page.get_attribute('#slider', 'max')), f'{moved} then {page.input_value("#slider")}')

    for scen, head_text, needle in [('logged', 'Refused', 'log-transformed'), ('entrez', 'Refused', 'not Ensembl'), ('mislabelled', 'Refused', 'Y-positive')]:
        page.click(f'button[data-scenario="{scen}"]')
        wait_head(page, head_text)
        check(f'Refuses: {scen}', needle in page.inner_text('#refusal-body') and page.locator('#refusal').is_visible(), page.inner_text('#refusal-title'))
    if SHOTS:
        page.screenshot(path=str(SHOTS / 'e2e_refused.png'))

    page.click('button[data-scenario="marrow"]')
    wait_head(page, 'Score rose in 3 of 3')
    check('Refusal clears when good data loads', not page.locator('#refusal').is_visible())

    page.click('button[data-scenario="early"]')
    wait_head(page, 'Forecast for 5 donors')
    check('One early sample per donor gives a forecast', page.locator('#plan-rows tr').count() == 5, page.inner_text('#in-sub')[:90])

    # Real upload: symbol ids, readable names, sheet built in the page
    page.click('button[data-scenario="upload"]')
    check('Upload form opens', page.locator('#upload').is_visible())
    page.set_input_files('#f-table', str(lab_table))
    page.wait_for_function("document.getElementById('sheet-rows').children.length > 0")
    check('Sample sheet is filled from column names', 'filled in 18' in page.inner_text('#sheet-note'), page.inner_text('#sheet-note'))
    page.select_option('#f-scale', 'counts')
    if SHOTS:
        page.screenshot(path=str(SHOTS / 'e2e_upload.png'), full_page=False)
    page.click('#upload button[type=submit]')
    wait_head(page, 'Score rose in 5 of 5')
    check('Uploaded symbol table gives the same result', page.locator('#rail li').count() >= 8, page.inner_text('#in-sub')[:70])

    with page.expect_download() as d:
        page.click('#dl-csv')
    path = d.value.path()
    lines = Path(path).read_text().splitlines()
    check('Scores download as CSV', d.value.suggested_filename.endswith('.csv') and len(lines) == 19 and lines[0].startswith('donor,passage'), lines[1])
    with page.expect_download() as d:
        page.click('#dl')
    rep = json.loads(Path(d.value.path()).read_text())
    check('Full report downloads as JSON', rep['status'] == 'REPORT' and rep['forecast']['donors'] and 'Not a release test' in rep['disclaimer'], f"{len(rep['forecast']['donors'])} donors")

    page.click('button[data-scenario="upload"]')
    page.set_input_files('#f-table', str(unclear))
    page.wait_for_timeout(600)
    page.click('#upload button[type=submit]')
    page.wait_for_timeout(500)
    check('Missing details are asked for, not guessed', 'need details' in page.inner_text('#in-headline'), page.inner_text('#in-sub')[:80])
    check('No uncaught errors in the page', not errors, errors[:2])

    if OFFLINE:
        page.goto(BASE, wait_until='load')
        page.wait_for_timeout(4000)
        ctx.set_offline(True)
        page.reload(wait_until='load')
        wait_head(page, 'Score rose in 5 of 5')
        check('Works offline after the first visit', True, page.inner_text('#status')[:90])
        ctx.set_offline(False)

    m = browser.new_context(viewport={'width': 390, 'height': 800}, device_scale_factor=2, has_touch=True).new_page()
    m.goto(BASE, wait_until='load')
    wait_head(m, 'Score rose in 5 of 5')
    over = m.evaluate('document.documentElement.scrollWidth - window.innerWidth')
    check('Phone layout has no sideways scroll', over <= 0, f'{over}px')
    if SHOTS:
        m.screenshot(path=str(SHOTS / 'e2e_phone.png'))
    browser.close()
print(f'\n{sum(results)} of {len(results)} passed')
sys.exit(0 if all(results) else 1)
