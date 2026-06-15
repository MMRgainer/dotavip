from tracker.cooldown import CooldownTracker, get_hero_list, cooldown_for, ABILITY_DB

ct = CooldownTracker()
heroes = get_hero_list()
print(f"Heroes in DB: {len(heroes)}")
print("Sample:", [h["display_name"] for h in heroes[:6]])

# Check lion abilities
lion = ABILITY_DB.get("lion", {})
print("\nLion abilities:", [a["display_name"] for a in lion.get("abilities", [])])

# Check a trigger
r = ct.trigger("lion", "lion_finger_of_death", 3, 0)
print("\ntrigger result:", r)

r2 = ct.trigger("antimage", "antimage_blink", 4, 1)
print("trigger antimage blink:", r2)
