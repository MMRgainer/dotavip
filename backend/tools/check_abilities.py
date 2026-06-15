import json
db = json.load(open('assets/hero_abilities.json', encoding='utf-8'))

for hero in ['windrunner', 'axe', 'crystal_maiden', 'antimage', 'lion']:
    h = db.get(hero, {})
    print(f'\n{hero}:')
    for ab in h.get('abilities', []):
        name = ab['name']
        ult = ab.get('ultimate', 'NO FIELD')
        cds = ab.get('cooldowns', [])
        print(f'  {name}: ultimate={ult} cd={cds}')
