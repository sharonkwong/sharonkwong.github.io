"""Email creative layout — the single definition of where the sections are.

Both the asset renderer and the dataset generator import this. If the boxes
lived in two places, the leader lines on the dashboard would eventually point
at the wrong band and nothing would fail loudly.

Boxes are fractions of the creative, so one spec serves every email size.
"""

# key, label, x, y, w, h  (fractions of the creative)
SECTIONS = [
    ("header", "Header",      0.00, 0.000, 1.00, 0.075),
    ("hero",   "Hero offer",  0.00, 0.075, 1.00, 0.285),
    ("menu",   "Menu grid",   0.00, 0.360, 1.00, 0.240),
    ("coupon", "Coupon",      0.00, 0.600, 1.00, 0.190),
    ("footer", "Footer",      0.00, 0.790, 1.00, 0.210),
]

# Share of that email's clicks landing in each section. Sums to 1 per creative.
CLICK_SHARES = {
    "cr-06": dict(header=0.04, hero=0.47, menu=0.23, coupon=0.18, footer=0.08),
    "cr-07": dict(header=0.05, hero=0.41, menu=0.21, coupon=0.25, footer=0.08),
    "cr-08": dict(header=0.04, hero=0.38, menu=0.16, coupon=0.33, footer=0.09),
}

# Copy per creative, keyed by section.
COPY = {
    "cr-06": dict(
        eyebrow="EVERY TUESDAY",
        hero_head="Two for Tuesday", hero_sub="Second pizza half price, all day",
        hero_cta="Order for tonight",
        menu=["Margherita", "Pepperoni", "Detroit-style"],
        coupon_head="Add garlic knots free", coupon_code="KNOTS", coupon_cta="Add to order",
        footer="Find your nearest shop"),
    "cr-07": dict(
        eyebrow="EVERY TUESDAY",
        hero_head="Still two for one", hero_sub="It has been a while — deal is still on",
        hero_cta="See the deal",
        menu=["Margherita", "Four cheese", "Hot honey"],
        coupon_head="$5 off any large", coupon_code="BACK5", coupon_cta="Redeem now",
        footer="Find your nearest shop"),
    "cr-08": dict(
        eyebrow="WE MISS YOU",
        hero_head="Here is $5", hero_sub="On your next order, any size",
        hero_cta="Redeem $5",
        menu=["Margherita", "Pepperoni", "Veggie"],
        coupon_head="$5 off, expires Sunday", coupon_code="MISSYOU", coupon_cta="Use my $5",
        footer="Find your nearest shop"),
}
