// =============================================
// HoloCase V5 - Slimmer + Premium Look
// =============================================

/* [Render Mode] */
// "base", "lid", or "both"
render_what = "both";

/* [Main Size] */
width      = 76.2;
height     = 101.6;
thickness  = 7.5;        // Slightly slimmer overall

/* [Card Cavity] */
card_width     = 66.0;
card_height    = 92.0;
card_thickness = 2.3;
clearance      = 0.5;

/* [Lid Design] */
lid_overlap    = 5.2;
wall           = 1.6;     // Main wall thickness
side_wall      = 1.4;     // Slightly thinner on sides for slim profile

/* [Features] */
label_depth = 0.85;
qr_size     = 27;
qr_depth    = 0.85;

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
        
        // Label recess (front)
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
        
        // Main overlap cavity
        translate([side_wall - 0.35, side_wall - 0.35, -0.1])
        cube([
            width - side_wall*2 + 0.7,
            height - side_wall*2 + 0.7,
            lid_overlap + 0.6
        ]);
        
        // Internal seating ledge
        translate([side_wall + 0.9, side_wall + 0.9, lid_overlap - 1.6])
        cube([
            width - side_wall*2 - 1.8,
            height - side_wall*2 - 1.8,
            3.5
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