import SwiftUI

/// Custom color definitions.
/// In a real Xcode project, these would be in an Asset Catalog.
/// For now, define them programmatically matching the PWA's blue-700/800 theme.
extension Color {
    static let primaryBlue = Color(red: 29/255, green: 78/255, blue: 216/255)    // ~blue-700
    static let primaryBlueDark = Color(red: 30/255, green: 64/255, blue: 175/255)  // ~blue-800
}

/// Note: Create a Color Set named "PrimaryBlue" in Assets.xcassets with:
/// - Light: #1D4ED8 (blue-700)
/// - Dark: #2563EB (blue-600)
///
/// Or reference these programmatic colors instead of Color("PrimaryBlue").
