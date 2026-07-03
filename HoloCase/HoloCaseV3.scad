// =============================================
// HoloCase V4 - Clean & Reliable Version
// Rounded corners + proper lid fit
// =============================================

/* [Render] */
// "base", "lid", or "both"
render_what = "both";

/* [Dimensions] */
width  = 76.2;     // 3"
height = 101.6;    // 4"
thickness = 8.0;

/* [Card Cavity] */
card_w = 66.0;
card_h = 92.0;
card_t = 2.3;
clearance = 0.45;   // Increase slightly if card is too tight

/* [Lid] */
lid_overlap = 5.0;
wall = 1.8;

/* [Features] */
label_depth = 0.9;
qr_size = 28;
qr_depth = 0.9;

/* [Rounding] */
r = 2.2;   // Corner radius

module rounded_rect(w, h, t, rad) {
    hull() {
        translate([rad, rad, 0]) cylinder(r=rad, h=t, $fn=48);
        translate([w-rad, rad, 0]) cylinder(r=rad, h=t, $fn=48);
        translate([rad, h-rad, 0]) cylinder(r=rad, h=t, $fn=48);
        translate([w-rad, h-rad, 0]) cylinder(r=rad, h=t, $fn=48);
    }
}

module base() {
    difference() {
        // Outer rounded body
        rounded_rect(width, height, thickness, r);
        
        // Card well
        translate([
            (width - card_w - clearance*2)/2,
            (height - card_h - clearance*2)/2,
            wall
        ])
        cube([card_w + clearance*2, card_h + clearance*2, card_t + 3]);
        
        // Front label recess
        translate([wall + 5, 8, -0.01])
        cube([width - wall*2 - 10, 18, label_depth + 0.1]);
        
        // Back QR recess
        translate([(width - qr_size)/2, height - qr_size - 8, thickness - qr_depth])
        cube([qr_size, qr_size, qr_depth + 0.1]);
    }
}

module lid() {
    difference() {
        // Outer rounded lid
        rounded_rect(width, height, thickness, r);
        
        // Main mating cavity (lid sits over base)
        translate([wall - 0.4, wall - 0.4, -0.1])
        cube([
            width - wall*2 + 0.8,
            height - wall*2 + 0.8,
            lid_overlap + 0.8
        ]);
        
        // Internal seating step
        translate([wall + 1.0, wall + 1.0, lid_overlap - 1.5])
        cube([
            width - wall*2 - 2.0,
            height - wall*2 - 2.0,
            3
        ]);
    }
}

// Render
if (render_what == "base" || render_what == "both") {
    color("Yellow") base();
}

if (render_what == "lid" || render_what == "both") {
    translate([0, 0, thickness + 2])
    color("Lime") lid();
}