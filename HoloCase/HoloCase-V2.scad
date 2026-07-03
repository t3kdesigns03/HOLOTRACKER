// =============================================
// HoloCase V2 - Premium Rigid Card Case
// For HOLOTracker
// Fits standard 3x4 top loader binder pages
// =============================================

/* [Render Mode] */
// "base", "lid", or "both"
render_what = "both";   

/* [Main Dimensions] */
case_width      = 76.2;   // 3 inches
case_height     = 101.6;  // 4 inches
case_thickness  = 8.0;    // Overall thickness (~0.315")

/* [Card Cavity] */
card_width      = 66.5;   // Card + sleeve width
card_height     = 92.5;   // Card + sleeve height
card_thickness  = 2.4;    // Penny sleeve + card
clearance       = 0.5;    // Adjust this after first print (0.4–0.7 recommended)

/* [Lid & Overlap] */
lid_overlap     = 4.5;    // How deep the lid sits over the base (bigger = better hold)
wall_thickness  = 1.8;    // Thicker = more rigid/premium feel

/* [Features] */
label_recess_depth = 0.9;
qr_recess_depth    = 0.9;
qr_size            = 28;

/* [Advanced] */
lid_wall_thickness = 1.6;

module base() {
    difference() {
        // Main body
        cube([case_width, case_height, case_thickness]);
        
        // Card cavity
        translate([
            (case_width - card_width - clearance*2)/2,
            (case_height - card_height - clearance*2)/2,
            wall_thickness
        ])
        cube([
            card_width + clearance*2,
            card_height + clearance*2,
            card_thickness + 2
        ]);
        
        // Label recess (front bottom)
        translate([wall_thickness + 4, 7, -0.01])
        cube([case_width - wall_thickness*2 - 8, 20, label_recess_depth + 0.1]);
        
        // QR recess (back)
        translate([
            (case_width - qr_size)/2,
            case_height - qr_size - 7,
            case_thickness - qr_recess_depth
        ])
        cube([qr_size, qr_size, qr_recess_depth + 0.1]);
    }
}

module lid() {
    difference() {
        // Outer lid
        cube([case_width, case_height, case_thickness]);
        
        // Inner cavity that fits over base
        translate([wall_thickness - 0.2, wall_thickness - 0.2, -0.1])
        cube([
            case_width - wall_thickness*2 + 0.4,
            case_height - wall_thickness*2 + 0.4,
            lid_overlap + 1
        ]);
        
        // Make lid walls thinner on top for weight
        translate([lid_wall_thickness, lid_wall_thickness, lid_overlap])
        cube([
            case_width - lid_wall_thickness*2,
            case_height - lid_wall_thickness*2,
            case_thickness
        ]);
    }
}

// Render
if (render_what == "base" || render_what == "both") {
    base();
}

if (render_what == "lid" || render_what == "both") {
    translate([0, 0, case_thickness + 2])   // Offset so they don't overlap when rendering both
    lid();
}