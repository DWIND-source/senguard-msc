"""Browser checks for the real, single-frame molecular preview.
Usage: python site/test/md_preview.py URL [SCREENSHOT_DIR] [--offline]
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

arguments = [a for a in sys.argv[1:] if a != '--offline']
base = arguments[0].rstrip('/')
shots = Path(arguments[1]) if len(arguments) > 1 else None
if shots:
    shots.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True,
        args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    context = browser.new_context(viewport={'width': 1320, 'height': 1000}, reduced_motion='reduce')
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(base + '/#molecular', wait_until='load')
    page.locator('#molecular').scroll_into_view_if_needed()
    page.wait_for_function('window.__mol?.data?.nca === 417')
    assert 'Production analysis pending' in page.locator('#molecular').inner_text()
    assert page.evaluate('window.__mol.data.frames') == 1
    assert len(page.locator('#md-source-hash').text_content()) == 64
    assert not page.evaluate('window.__mol.controls.autoRotate')
    print('PASS: real frame, provenance and reduced-motion preference')

    # Check the actual rendered buffer, not just canvas existence.
    page.wait_for_timeout(500)
    count = page.evaluate('''() => {
      const r = window.__mol.renderer, gl = r.getContext();
      const p = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
      gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, p);
      let n = 0; for (let i = 3; i < p.length; i += 4) if (p[i]) n++; return n;
    }''')
    assert count > 1000, count
    print('PASS: protein is rendered')
    if shots:
        page.locator('#molecular').screenshot(path=str(shots / 'molecular_desktop.png'))

    page.click('#md-preview-views [data-mode="interface"]')
    assert page.evaluate('window.__mol.mode') == 'interface'
    page.click('#md-preview-views [data-mode="water"]')
    assert page.evaluate('window.__mol.water.visible')
    assert page.evaluate('window.__mol.water.children[0].geometry.attributes.position.count') == 18459
    page.click('#md-rotate')
    assert page.evaluate('window.__mol.controls.autoRotate')
    page.click('#md-rotate')
    assert not page.evaluate('window.__mol.controls.autoRotate')
    assert page.evaluate('window.__mol.frame') == 0
    print('PASS: interface, solvent and camera controls do not invent trajectory frames')
    if shots:
        page.locator('#molecular').screenshot(path=str(shots / 'molecular_water.png'))

    page.set_viewport_size({'width': 390, 'height': 844})
    page.click('#md-preview-views [data-mode="chain"]')
    page.locator('#molecular').scroll_into_view_if_needed()
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert page.locator('#md-preview-views [data-mode="water"]').is_visible()
    if shots:
        page.locator('#molecular').screenshot(path=str(shots / 'molecular_phone.png'))
    assert not errors, errors
    print('PASS: mobile layout and no uncaught errors')

    if '--offline' in sys.argv:
        page.wait_for_function('navigator.serviceWorker.controller !== null')
        context.set_offline(True)
        page.reload(wait_until='load')
        page.locator('#molecular').scroll_into_view_if_needed()
        page.wait_for_function('window.__mol?.data?.nca === 417')
        page.click('#md-preview-views [data-mode="water"]')
        assert page.evaluate('window.__mol.water.visible')
        context.set_offline(False)
        print('PASS: molecular geometry and solvent work offline')

    broken = browser.new_context(service_workers='block').new_page()
    broken.route('**/data/md/preview.json.gz', lambda r: r.fulfill(status=503, body='unavailable'))
    broken.goto(base + '/#molecular', wait_until='load')
    broken.locator('#molecular').scroll_into_view_if_needed()
    broken.wait_for_function("document.getElementById('md-loading').textContent.includes('could not load')")
    assert broken.locator('#md-preview-controls').is_hidden()
    print('PASS: missing data has an honest fallback')
    browser.close()
