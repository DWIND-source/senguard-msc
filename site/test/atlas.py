"""Check the linked visual atlas with real demo data, including mobile layouts."""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

base = sys.argv[1].rstrip('/')
shots = Path('deliverables/qa/atlas')
shots.mkdir(parents=True, exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(channel='msedge', headless=True,
        args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    ctx = browser.new_context(viewport={'width': 1400, 'height': 1050}, reduced_motion='reduce')
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(base + '/?still=1', wait_until='load')
    page.wait_for_selector('#atlas-heatmap rect[data-sample]')
    assert page.locator('#atlas-heatmap .atlas-gene').count() == 24
    assert page.locator('#atlas-pca .atlas-point').count() == 18
    assert page.locator('#atlas-heatmap rect[data-sample]').count() == 24 * 18
    assert page.locator('#forecast-chart path').count() == 5
    assert page.locator('#forecast-chart circle').count() == 18
    print('PASS: 24 available genes x 18 real samples; measured and forecast marks are present')
    # A plotted value must agree with the sample inspector, not a decorative fixture.
    page.select_option('#atlas-gene', 'CDKN2A')
    sample = page.locator('#atlas-pca .atlas-point').nth(3)
    sample_id = sample.get_attribute('data-sample')
    sample.click()
    assert sample_id in page.locator('#record').inner_text()
    assert page.locator('#atlas-heatmap rect.atlas-selected').count() == 24
    heat_tip = page.locator(f'#atlas-heatmap rect[data-gene="CDKN2A"][data-sample="{sample_id}"]').get_attribute('data-tip')
    assert 'log1p expression:' in heat_tip and 'row z-score:' in heat_tip
    print('PASS: sample selection links PCA, heatmap and the sample record')
    before = page.locator('#atlas-heatmap rect[data-gene="CDKN2A"]').evaluate_all('(xs) => xs.map(x=>x.dataset.sample)')
    page.select_option('#atlas-order', 'donor')
    after = page.locator('#atlas-heatmap rect[data-gene="CDKN2A"]').evaluate_all('(xs) => xs.map(x=>x.dataset.sample)')
    assert before != after and sorted(before) == sorted(after)
    page.select_option('#atlas-gene', 'MKI67')
    assert 'MKI67' in page.locator('#atlas-curve svg').get_attribute('aria-label')
    page.locator('#atlas-heatmap text[data-gene="CDK6"]').press('Enter')
    assert page.locator('#atlas-gene').input_value() == 'CDK6'
    print('PASS: ordering, gene selector and keyboard interaction')
    page.add_style_tag(content='.top { position: static !important; }')
    page.locator('#expression-atlas').screenshot(path=str(shots / 'desktop.png'))
    page.locator('#forecast-chart').screenshot(path=str(shots / 'forecast.png'))
    assert not page.locator('.evidence-details').get_attribute('open')
    assert 'For research use' not in page.locator('.hero').inner_text()
    page.locator('.evidence-details > summary').click()
    assert 'What goes against it' in page.locator('.evidence-details').inner_text()
    print('PASS: concise presentation with complete validation details accessible')
    page.set_viewport_size({'width': 390, 'height': 844})
    page.locator('#expression-atlas').scroll_into_view_if_needed()
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert page.locator('#atlas-heatmap').evaluate('e=>e.scrollWidth>e.clientWidth')
    page.locator('#expression-atlas').screenshot(path=str(shots / 'phone.png'))
    page.click('button[data-scenario="marrow"]')
    page.wait_for_function("document.getElementById('in-headline').textContent.includes('3 of 3')")
    assert page.locator('#atlas-pca .atlas-point').count() == 9
    page.click('button[data-scenario="logged"]')
    page.wait_for_function("document.getElementById('in-headline').textContent === 'Refused'")
    assert page.locator('#expression-atlas').count() == 0
    page.click('button[data-scenario="early"]')
    page.wait_for_selector('#forecast-chart svg')
    assert page.locator('#expression-atlas').count() == 0
    assert page.locator('#forecast-chart circle').count() == 5
    assert not errors, errors
    print('PASS: mobile, cohort switching, invalid-input reset and early-sample forecast')
    browser.close()
