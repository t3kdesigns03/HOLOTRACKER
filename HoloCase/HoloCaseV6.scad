// =============================================
// HoloCase V6 - Final Dimension Locked Version
// Outer: 3" x 4" | Good fit for 35pt + sleeve
// =============================================

/* [Render Mode] */
// "base", "lid", or "both"
render_what = "both";

/* [Locked Outer Dimensions] */
width     = 76.2;     // Exactly 3 inches
height    = 101.6;    // Exactly 4 inches
thickness = 8.4;      // Slightly thicker for rigidity

/* [Card Cavity - Tuned for standard trading cards] */
card_width     = 66.0;   // ~2.6 inches
card_height    = 92.0;   // ~3.62 inches
card_thickness = 2.4;
clearance      = 0.55;   // Comfortable but not sloppy

/* [Lid] */
lid_overlap = 5.0;
wall        = 1.7;
side_wall   = 1.5;       // Slightly thinner sides for slim profile

/* [Features] */
label_depth = 0.9;
qr_size     = 27;
qr_depth    = 0.9;

/* [Rounding] */
corner_r = 2.0;

module rounded_box(w, h, t, r) {
    hull() {
        translate([r, r, 0]) cylinder(r=r, h=t, $fn=64);
        translate([w-r, r, 0]) cylinder(r=r, h=t, $fn=64);
        translate([r, h-r, 0]) cylinder(r=r, h=t, $fn=64);
        translate([w-r, h-r, 0]) cylinder(r=r, h=t, $fn=64);
    }
}

module base() {
    difference() {
        rounded_box(width, height, thickness, corner_r);
        
        // Card cavity
        translate([
            (width - card_width - clearance*2)/2,
            (height - card_height - clearance*2)/2,
            wall
        ])
        cube([card_width + clearance*2, card_height + clearance*2, card_thickness + 3]);
        
        // Label recess (front bottom)
        translate([wall + 5, 7, -0.01])
        cube([width - wall*2 - 10, 18, label_depth + 0.1]);
        
        // QR recess (back)
        translate([(width - qr_size)/2, height - qr_size - 7, thickness - qr_depth])
        cube([qr_size, qr_size, qr_depth + 0.1]);
    }
}

module lid() {
    difference() {
        rounded_box(width, height, thickness, corner_r);
        
        // Main overlap
        translate([side_wall - 0.3, side_wall - 0.3, -0.1])
        cube([
            width - side_wall*2 + 0.6,
            height - side_wall*2 + 0.6,
            lid_overlap + 0.5
        ]);
        
        // Internal seating step
        translate([side_wall + 0.85, side_wall + 0.85, lid_overlap - 1.5])
        cube([
            width - side_wall*2 - 1.7,
            height - side_wall*2 - 1.7,
            3.2
        ]);
    }
}

// Render
if (render_what == "base" || render_what == "both") {
    color("Gold") base();
}

if (render_what == "lid" || render_what == "both") {
    translate([0, 0, thickness + 2])
    color("DeepSkyBlue") lid();
}