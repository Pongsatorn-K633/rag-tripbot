# Column reference — Dopamichi trip plan

Defines what each column in the Excel template means and how it maps to JSON.
The Excel/JSON is consumed by another repo to render the itinerary for the
Dopamichi Japan travel-planner app. Use this as the source of truth when
authoring a plan (see `SKILL.md`).

## The Excel and JSON schema

### 1. Overview block — headers in Row 1, values in rows 2–13

Column A here holds row labels: Primary, Details, Highlight Place 1–8, Reference Date.

| Col | Header | JSON key |
| ----- | ----- | ----- |
| B | Title | overview.title |
| C | Description | overview.description (full text, shown inside the trip) |
| — | Cover Tagline | overview.cover_tagline (short hook shown on the cover card; JSON-only) |
| D | Available Period | overview.available_period |
| E | Recommended Period(s) | overview.recommended_period (array — one or more `{primary, details}` windows) |
| F | Levels | (highlight level) |
| G | Area code | overview.area_code |
| H | Cover Images | overview.cover_images |
| — | Cover Places (JSON-only) | overview.cover_places — place name per cover, same order as cover_images (hero chip in the preview) |
| — | Popular period (JSON-only) | recommended_period[].popular — `true` shows a "Popular" badge on that window in the preview |
| I | Available Airports | overview.available_airports (JSON) |
| J | Car Rental | overview.car_rental (JSON) |
| K | Arrival to First Act (hrs) | overview.arrival_to_first_act_hrs |
| L | Arrival to Departure Airport (hrs) | overview.arrival_to_departure_airport_hrs |
| M | Logistic Guide (EN) | overview.logistic_guide_en |
| N | Logistic Guide (TH) | overview.logistic_guide_th |
| O | Accommodation Guide (EN) | overview.accommodation_guide_en |
| P | Accommodation Guide (TH) | overview.accommodation_guide_th |
| Q | Food Guide (EN) | overview.food_guide_en |
| R | Food Guide (TH) | overview.food_guide_th |
| S | Remark (EN) | overview.remark_en |
| T | Remark (TH) | overview.remark_th |
| U | Queue Guide (EN) | overview.queue_guide_en |
| V | Queue Guide (TH) | overview.queue_guide_th |

### 2. Itinerary table — headers in Row 14, activities from row 15

| Col | Header | JSON key |
| ----- | ----- | ----- |
| A | Day | day.day (first row of each day only) |
| B | Name (EN) | day.name.en |
| C | Name (TH) | day.name.th |
| D | Location | location |
| E | Slot | slot |
| F | Default? | is_default (Y/N → bool) |
| G | Time | time |
| H | Duration (+mins) | duration_min |
| I | Priority | priority |
| J | Activity Name (EN) (Maps API) | name.en |
| K | Activity Name (TH) (Maps API) | name.th |
| L | Description (EN) | description.en |
| M | Description (TH) | description.th |
| N | Cost (Maps API) | cost |
| O | Map URL (Maps API) | links.map |
| P | Walking Route URL (Our Route) | links.walking_route |
| Q | Extra Notes (EN) | notes.en |
| R | Extra Notes (TH) | notes.th |
| S | Important Remark (EN) | remark.en |
| T | Important Remark (TH) | remark.th |
| U | queueTime | queue_time |
| V | bookingPolicy | booking_policy |
| W | How to Book | how_to_book |
| X | Category (pick in app) | category |
| Y | Rating (Maps API) | rating |
| Z | Operating Hours (Maps API) | operating_hours |
| AA | Google Maps API call | maps_api_call (Y/N → bool) |
| AB | IG Link | links.ig |
| AC | FB Link | links.fb |
| AD | TT Link | links.tt |
| AE | Website Link | links.website |

## Itinerary Column Details (A–AF) — what to fill / what the user expects

Use this when authoring a plan from a request (e.g. *"create me a Tokyo 1-day tour"*): fill every column per the rules below. Columns tagged **EN+TH** need content in both languages. `(Maps API)` columns can be pulled from Google Maps by the admin instead of typed in Excel.

**A — Day** (`day.day`) — Trip day number (1, 2, 3 …). Written **only on the first row of each day**; leave blank on the following rows of the same day. A 1-day tour puts `1` on its first row.

**B — Name (EN)** (`day.name.en`) — Short, catchy English theme/title for the whole day (e.g. *"Japan, I'm coming"*). First row of the day only.

**C — Name (TH)** (`day.name.th`) — Thai version of the day title. First row of the day only.

> **`day.highlight` (JSON-only, optional)** — `{ en, th }` one-liner shown in the trip preview's
> **Day Highlights** card (e.g. *"เดินเล่น Ikebukuro, ชมแสงสี Shinjuku"*). Not an Excel column.
> When absent, the preview derives the line from the day's Must/Recommend activities instead —
> so author it only when the derived line isn't good enough.

**D — Location** (`location`) — Area of this activity as `"City, District"` (e.g. *"Tokyo, Ikebukuro"*). Drives geo grouping; keep consistent within a day's region.

**E — Slot** (`slot`) — Row type. One of: Logistics, Living, Admin & Services, Breakfast, Brunch, Lunch, AfternoonMeal, Dinner, LatenightMeal, Activity 1–8. Meals = food; Activity = sightseeing **and cafes**; Logistics = transport/transit; Living = accommodation/rest; Admin & Services = check-in, luggage drop, car rental, etc. See **Slot choice rule** below.

**F — Default?** (`is_default`, Y/N→bool) — Inside a choice group (adjacent repeated choosable slot), mark exactly **one** row `Y` = recommended default; the rest `N` = alternatives. For a single, non-repeated slot leave it blank.

**G — Time** (`time`, `HH:MM` 24h) — Start time. Set it on the default/primary row of a choice group; the alternatives inherit it. Times should ascend through the day.

**H — Duration (+mins)** (`duration_min`, int) — Minutes spent at the activity; added to Time to derive the next slot's start. Use `0` for an end-of-day "back to accommodation".

**I — Priority** (`priority`) — `Must` / `Recommend` / `Normal`. **Must**: essential — the trip breaks or money is lost if skipped (airport, car pickup, check-in). **Recommend**: admin's favorite, worth doing. **Normal**: default.

**J — Activity Name (EN)** (`name.en`, Maps API) — English name of the place/restaurant/activity, or an action label for logistics rows (e.g. *"Train from Ikebukuro to Shinjuku"*).

**K — Activity Name (TH)** (`name.th`, Maps API) — Thai name/label. Proper-noun venues keep the romanized (Latin) name; translate only the action labels. This applies to *all* proper place/venue names in *every* Thai field (not just this column) — see the **Bilingual / Thai style** section below for the full romanize-names / keep-loanwords / cut-filler rules.

**L — Description (EN)** (`description.en`, **EN**) — Brief 1–2 sentence description of the place/activity. Extend to align with any extra detail the user gives.

**M — Description (TH)** (`description.th`, **TH**) — Thai 1–2 sentence description, aligned with L.

**N — Cost (Maps API)** (`cost`) — Price tier on the ฿ scale (see **Cost Field**): Restaurants ฿/฿฿/฿฿฿ by THB per person; Hotels by THB per room/night. Format like `"฿฿ (Mid-range / ระดับกลาง)"`. For transport, the actual fare (e.g. `"¥200 (~฿41)"`).

**O — Map URL (Maps API)** (`links.map`) — Google Maps share link to the venue (Maps API `googleMapsUri`).

**P — Walking Route URL (Our Route)** (`links.walking_route`) — Our custom Google Maps **walking-directions** URL drawn between points (distinct from a single-place pin).

**Q — Extra Notes (EN)** (`notes.en`) — Optional further info extending the description, in English.

**R — Extra Notes (TH)** (`notes.th`) — Thai extra notes, aligned with Q.

**S — Important Remark (EN)** (`remark.en`) — Must-know info so the user can reach/complete it without struggle (e.g. *"Get off at Takadanobaba Station (before Shinjuku)."*). English.

**T — Important Remark (TH)** (`remark.th`) — Thai, aligned with S (e.g. *"ต้องลงที่สถานี Takadanobaba (ก่อนถึง Shinjuku)"*).

**U — queueTime** (`queue_time`) — `Low` / `Mid` / `High` / `Reserve`. Expected crowd/wait (see **Queue**). Pairs with **V** via the **15-case matrix** to render the UI message.

**V — bookingPolicy** (`booking_policy`) — `Walk-in Only` / `Same-Day Ticket` / `Optional` / `Recommended` / `Mandatory` (see **Booking Matrix**). Pairs with **U**.

**W — How to Book** (`how_to_book`) — Concrete method/platform when booking applies (e.g. *"Online Booking Platform / Hotel Website"*, a reservation URL, or an app name).

**X — Category (pick in app)** (`category`) — Category tag **chosen in the admin dashboard** (not auto-filled), e.g. shopping, nature, temple, cafe.

**Y — Rating (Maps API)** (`rating`) — Numeric Google star rating (e.g. `4.7`), usually pulled from Maps API.

**Z — Operating Hours (Maps API)** (`operating_hours`) — Opening hours; Maps API `regularOpeningHours` / `currentOpeningHours`, or typed manually.

**AA — Google Maps API call** (`maps_api_call`, Y/N→bool) — Whether this row should fetch live Google Maps data. `Y` for real venues; blank for logistics/action rows. **All meal/food slots are real venues, so `maps_api_call` is always `true` for them** — Breakfast, Brunch, Lunch, AfternoonMeal, Dinner, LatenightMeal. (Sightseeing/cafe `Activity` rows that are real places are `true` too; only Logistics / Living / Admin & Services action rows are blank.)

**AB — IG Link** (`links.ig`) — Instagram URL of the place, if any.

**AC — FB Link** (`links.fb`) — Facebook URL.

**AD — TT Link** (`links.tt`) — TikTok URL.

**AE — Website Link** (`links.website`) — The venue's official website URL (Maps API `websiteUri`, which also auto-grabs the Facebook page when there's no standalone site). This is the single website field; the former "Website URL" (AF) column has been removed as a duplicate.

### Slot choice rule (adjacent & repeated)

When one of these **choosable** slots repeats on **adjacent rows within the same day**, those rows are alternative **choices** the user picks between — column **F (Default?)** marks the one recommended option. Only the **meal** slots are choosable:

> Breakfast, Brunch, Lunch, AfternoonMeal, Dinner, LatenightMeal

All other slots (Logistics, Living, Admin & Services, **Activity 1–8**) are **not** treated as choices, even if they repeat — each row is its own timeline entry.

## Field value references

### Priority

* **Must** — need to do; if not, cannot continue the trip or lose money.
* **Recommend** — admin's favourite attraction, food, hotel, or activity that's worth doing in the trip.
* **Normal** — default.

### Slot (all values)

Logistics, Living, Breakfast, Brunch, Lunch, AfternoonMeal, Dinner, LatenightMeal, Admin & Services, Activity 1, Activity 2, Activity 3, Activity 4, Activity 5, Activity 6, Activity 7, Activity 8.

(Activity includes cafes too. Breakfast, Brunch, Lunch, AfternoonMeal, Dinner, LatenightMeal are meals.)

### Cost Field

**Restaurants** — estimated average cost per person in THB:

- **฿ (Budget / ประหยัด):** < 300 THB — street food stalls, night market vendors, food courts, local made-to-order shops, fast food chains, casual coffee stands, grab-and-go bakeries.
- **฿฿ (Mid-range / ระดับกลาง):** 300 – 1,200 THB — casual sit-down dining, standard shopping-mall restaurants, specialty cafes, popular izakayas, mid-tier family restaurants.
- **฿฿฿ (Luxury / หรูหรา):** > 1,200 THB — fine dining, omakase, rooftop bars, upscale hotel restaurants, premium specialty dining.

**Hotels** — estimated average cost per room per night in THB:

- **฿ (Budget / ประหยัด):** < 2,500 THB — hostels, guesthouses, capsule hotels, basic transit hotels, standard business hotels (APA Hotel, Toyoko Inn, Dormy Inn).
- **฿฿ (Mid-range / ระดับกลาง):** 2,500 – 6,000 THB — 3–4-star hotels, boutique accommodations, standard serviced apartments, standard traditional lodgings.
- **฿฿฿ (Luxury / หรูหรา):** > 6,000 THB — 5-star international hotel chains, luxury resorts, boutique luxury villas, premium traditional lodgings.

### Queue (queueTime levels)

- **Low (Walk-in friendly):** Minimal to no wait expected. You can likely walk right in and enjoy!
- **Mid (Moderate Queue):** Expect a standard meal-rush wait (usually 30–60 mins). These are beloved local favorites, so grab a spot in line — the food is worth your time.
- **High (Heavy Crowds):** Major hotspots where lines can easily exceed 1–2 hours. If your schedule is flexible, your patience will be rewarded.
- **Reserve:** Reservation-based venue (see the matrix below with bookingPolicy).

### Booking Matrix (bookingPolicy values)

1. **Walk-in Only** — no advance reservations exist; you must physically stand in line. 🚫 ไม่รับจองล่วงหน้า: ต้องไปต่อคิวหน้าร้านเท่านั้น
2. **Same-Day Ticket** — no advance booking; go in person early to pull a time-slot ticket (Seiriken). 🎟️ ระบบแจกบัตรคิว (Seiriken): ต้องมารับบัตรคิวหน้าร้านล่วงหน้า
3. **Optional** — bookings exist, but walk-ins are completely safe and standard. (Leave blank to keep UI clean.)
4. **Recommended** — bookings exist, but walk-ins are highly risky/likely to be rejected. 📝 แนะนำให้จองล่วงหน้า: ป้องกันคิวเต็มหรือโดนปฏิเสธหน้าร้าน
5. **Mandatory** — strict reservation-only venues; walk-ins explicitly rejected. ⚠️ ต้องจองล่วงหน้าเท่านั้น: ไม่รับลูกค้า Walk-in เด็ดขาด

### Streamlined queueTime × bookingPolicy (15 valid cases)

| queueTime | bookingPolicy | UI shown (Thai) | UI shown (Eng) |
| :---- | :---- | :---- | :---- |
| **Low** | Walk-in Only | 🟢 สามารถเข้าใช้บริการได้สะดวก *(รับเฉพาะ Walk-in)* | 🟢 Easy to walk in *(Walk-in only)* |
| **Low** | Same-Day Ticket | 🟢 สามารถเข้าใช้บริการได้สะดวก *(รับคิวหน้าร้าน/แอป)* | 🟢 Easy to walk in *(Queue via app/onsite)* |
| **Low** | Optional | 🟢 สามารถเข้าใช้บริการได้สะดวก *(มีตัวเลือกจองโต๊ะล่วงหน้า)* | 🟢 Easy to walk in *(Advance booking optional)* |
| **Low** | Recommended | 🟢 สามารถเข้าใช้บริการได้สะดวก *(แนะนำให้จองล่วงหน้า)* | 🟢 Easy to walk in *(Advance booking recommended)* |
| **Mid** | Walk-in Only | ⚠️ คิวปานกลาง: มักมีคิวช่วงมื้ออาหาร แนะนำให้เผื่อเวลาสำหรับรอคิว *(รับเฉพาะ Walk-in)* | ⚠️ Moderate queue: Expect lines during peak hours. Please allocate wait time. *(Walk-in only)* |
| **Mid** | Same-Day Ticket | ⚠️ คิวปานกลาง: มักมีคิวช่วงมื้ออาหาร แนะนำให้เผื่อเวลาสำหรับรอคิว *(รับคิวหน้าร้าน/แอป)* | ⚠️ Moderate queue: Expect lines during peak hours. Please allocate wait time. *(Queue via app/onsite)* |
| **Mid** | Optional | ⚠️ คิวปานกลาง: มักมีคิวช่วงมื้ออาหาร แนะนำให้เผื่อเวลาสำหรับรอคิว *(จองโต๊ะล่วงหน้าได้)* | ⚠️ Moderate queue: Expect lines during peak hours. Please allocate wait time. *(Advance booking optional)* |
| **Mid** | Recommended | ⚠️ คิวปานกลาง: มักมีคิวช่วงมื้ออาหาร แนะนำให้เผื่อเวลาสำหรับรอคิว *(แนะนำให้จองล่วงหน้า)* | ⚠️ Moderate queue: Expect lines during peak hours. Please allocate wait time. *(Advance booking recommended)* |
| **High** | Walk-in Only | 🚨 คิวหนาแน่นมาก: ร้านดังยอดฮิต มีคิวค่อนข้างนาน ต้องเผื่อเวลาสำหรับรอคิว *(รับเฉพาะ Walk-in)* | 🚨 Heavy crowds: Popular hotspot with long queues. Expect significant wait time. *(Walk-in only)* |
| **High** | Same-Day Ticket | 🚨 คิวหนาแน่นมาก: ร้านดังยอดฮิต มีคิวค่อนข้างนาน ต้องเผื่อเวลาสำหรับรอคิว *(รับคิวหน้าร้าน/แอป)* | 🚨 Heavy crowds: Popular hotspot with long queues. Expect significant wait time. *(Queue via app/onsite)* |
| **High** | Optional | 🚨 คิวหนาแน่นมาก: ร้านดังยอดฮิต มีคิวค่อนข้างนาน ต้องเผื่อเวลาสำหรับรอคิว *(จองโต๊ะล่วงหน้าได้)* | 🚨 Heavy crowds: Popular hotspot with long queues. Expect significant wait time. *(Advance booking optional)* |
| **High** | Recommended | 🚨 คิวหนาแน่นมาก: ร้านดังยอดฮิต มีคิวค่อนข้างนาน ต้องเผื่อเวลาสำหรับรอคิว *(แนะนำจองล่วงหน้าเพื่อข้ามคิว)* | 🚨 Heavy crowds: Popular hotspot with long queues. Expect significant wait time. *(Booking recommended to skip the line)* |
| **Reserve** | Optional | 📅 เปิดให้จองล่วงหน้า *(Walk-in มีจำนวนจำกัด)* | 📅 Advance booking available *(Walk-in availability is highly limited)* |
| **Reserve** | Recommended | 📅 แนะนำให้จองล่วงหน้า *(Walk-in มีความเสี่ยงที่จะไม่ได้โต๊ะ)* | 📅 Advance booking recommended *(High risk of no tables for walk-ins)* |
| **Reserve** | Mandatory | 📅 ต้องจองล่วงหน้าเท่านั้น: ร้านไม่รับ Walk-in กรุณาสำรองที่นั่งล่วงหน้า | 📅 Advance booking strictly required: No walk-ins accepted. Please reserve ahead. |

### Google Maps API fields

For columns marked `(Maps API)`, the admin chooses (in the admin dashboard)
whether to pull the value from the Google Maps API or use what's in Excel/JSON.

- **`id`** – the unique Google Place ID.
- **`displayName`** – the localized name of the restaurant, hotel, or attraction.
- **`formattedAddress`** – the full, human-readable address.
- **`location`** – the exact map coordinates (lat/long).
- **`businessStatus`** – operational / temporarily closed / permanently closed.
- **`googleMapsUri`** – direct URL to open the location in Google Maps.
- **`regularOpeningHours`** – the baseline standard weekly schedule, day by day.
- **`currentOpeningHours`** – rolling 7-day hours capturing holiday/festival/winter changes.
- **`priceLevel`** – cost range as an integer 0 (free) to 4 (very expensive).
- **`rating`** – the overall numeric star rating (e.g. 4.7).
- **`websiteUri`** – the primary external link from the business (auto-grabs their Facebook page if no standalone site).
- **`nationalPhoneNumber`** – the local phone number for reservations/inquiries.

## Bilingual / Thai style — how to write the `{en,th}` fields

Defines *how* the Thai/English wording should read (the section above defines *what* each
column means). Applies to all bilingual fields: `name{en,th}`, `description{en,th}`,
`notes{en,th}`, `remark{en,th}`, and the day theme `name{en,th}`.

**Faithfulness.** EN and TH must say the same thing. Never add hours/prices/claims that
aren't in the source; if a fact isn't confirmed, the field stays `null` (translating does
not mean inventing). The admin may write the source in English only; the Thai is generated
from it and aligned EN ↔ TH 1:1.

### Rule 1 — Romanize ALL proper place / venue names (don't transliterate)

Keep every **proper noun** — place, city, station, district, region, and the venue's own
name — in **Latin script** in *both* languages, *everywhere*, including inside flowing Thai
sentences. Do **not** spell them out in Thai script.

- ✅ `เดินเล่นยามค่ำใน Matsumoto` ❌ `เดินเล่นยามค่ำในมัตสึโมโตะ`
- ✅ `รถไฟจาก Shinjuku ไป Ikebukuro` ❌ `รถไฟจากชินจูกุไปอิเคะบุคุโระ`
- ✅ `ท่องราตรีที่ Kabukicho` ❌ `ท่องราตรีที่คาบุกิโจ`

This is a **general** rule — detect *all* names, not just the obvious one: Matsumoto, Tokyo,
Narita, Ikebukuro, Shinjuku, Kabukicho, Omoide, Kamikochi, Ogizawa, Hotel Iidaya, Firework
Bar Matsuri, etc. Put a **space** on each side of the embedded Latin token.

**Why:** users match names against Google Maps and on-site signage (Latin), the Maps API
`displayName` is Latin, and Thai transliteration has no canonical spelling, so it drifts.
(Matches col K, extended here to prose.) Translate only the **generic / action words** around
the name — "Night Walk", "Drive to", "Train from … to …", "Check-in", "Back to accommodation".

### Rule 2 — Keep naturalized Thai words in Thai

Do **not** romanize words that are genuinely Thai or fully naturalized loanwords:

- Country / common geography that has a real Thai word: **ญี่ปุ่น** (Japan).
- Food & culture loanwords that read naturally in Thai: **อิซากายะ, ราเมง, โซบะ, ยากิโทริ,
  ซันโซคุยากิ, โทจิโซบะ, โยโกโจ, อุนางิ, มิโซะ, คุระ**.

The line: a *proper name of a specific place/venue* → Latin (Rule 1); a *common noun / dish /
category* → natural Thai.

### Rule 3 — Keep it tight (cut filler) in both languages

Descriptions should be concise and natural. Trim padding in EN and TH alike.

- EN: drop "perfected for", "long-established …", piled-on adjectives, "we gonna".
- TH: drop "แบบ…", "เรียงรายด้วย", redundant classifiers and adjectives.
- Aim for one or two clean sentences that state what the place is known for.

### Quick checklist before saving

1. Every proper place/venue name is in Latin in both EN and TH (Rule 1).
2. ญี่ปุ่น and food/culture loanwords are still Thai (Rule 2).
3. Spaces around each embedded Latin token; no space before Thai/EN punctuation.
4. EN and TH say the same thing; no invented facts; unknowns left `null`.
5. No filler — both languages read tight (Rule 3).
