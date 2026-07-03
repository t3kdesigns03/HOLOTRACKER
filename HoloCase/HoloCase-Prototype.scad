// =============================================
// HoloCase Prototype for HOLOTracker
// Slim rigid trading card case (fits 3x4 top loader binder pages)
// Dimensions in mm
// =============================================

/* [Case Dimensions] */
// External width (3 inches)
case_width = 76.2;
// External height (4 inches)
case_height = 101.6;
// External thickness
case_thickness = 7.0;  // ~0.275 inches

/* [Card Cavity] */
// Card + sleeve width
card_width = 66;
// Card + sleeve height
card_height = 92;
// Card thickness (penny sleeve + card)
card_thickness = 2.2;
// Extra clearance around card
clearance = 0.4;

/* [Walls & Features] */
// Wall thickness
wall_thickness = 1.4;
// Label recess depth (front bottom)
label_recess_depth = 0.8;
// QR recess depth (back)
qr_recess_depth = 0.8;
// QR area size
qr_size = 30;

/* [Render Options] */
// Render lid or base (change to false for lid)
render_base = true;

module case_base() {
    difference() {
        // Outer shell
        cube([case_width, case_height, case_thickness]);
        
        // Inner card cavity
        translate([
            (case_width - card_width - clearance*2)/2,
            (case_height - card_height - clearance*2)/2,
            wall_thickness
        ])
        cube([
            card_width + clearance*2,
            card_height + clearance*2,
            card_thickness + 1
        ]);
        
        // Front label recess (bottom)
        translate([
            wall_thickness + 5,
            8,
            0
        ])
        cube([
            case_width - wall_thickness*2 - 10,
            18,
            label_recess_depth + 0.1
        ]);
        
        // Back QR recess
        translate([
            (case_width - qr_size)/2,
            case_height - qr_size - 8,
            case_thickness - qr_recess_depth
        ])
        cube([qr_size, qr_size, qr_recess_depth + 0.1]);
    }
}

module case_lid() {
    difference() {
        // Outer lid shell (slightly larger for fit)
        translate([0, 0, case_thickness - wall_thickness])
        cube([case_width, case_height, wall_thickness + 1]);
        
        // Inner lid cavity (to overlap base)
        translate([
            wall_thickness + 0.2,
            wall_thickness + 0.2,
            case_thickness - wall_thickness - 0.1
        ])
        cube([
            case_width - wall_thickness*2 - 0.4,
            case_height - wall_thickness*2 - 0.4,
            wall_thickness + 1
        ]);
    }
}

// Render
if (render_base) {
    case_base();
} else {
    case_lid();
}

// Optional: Add text branding (uncomment if desired)
// translate([case_width/2, 12, case_thickness - 0.4])
// linear_extrude(0.6)
// text("HoloCase", size=6, halign="center", valign="center");/x