import SwiftUI

@main
struct ParleApp: App {
    @StateObject private var authVM = AuthViewModel()

    var body: some Scene {
        WindowGroup {
            Group {
                if authVM.isAuthenticated {
                    MainTabView()
                        .environmentObject(authVM)
                } else {
                    LoginView()
                        .environmentObject(authVM)
                }
            }
            .onAppear {
                Task { await authVM.checkSession() }
            }
        }
    }
}

struct MainTabView: View {
    @EnvironmentObject var authVM: AuthViewModel

    var body: some View {
        TabView {
            DashboardView()
                .tabItem {
                    Label("Home", systemImage: "house.fill")
                }

            ConversationView()
                .tabItem {
                    Label("Practice", systemImage: "mic.fill")
                }

            HistoryView()
                .tabItem {
                    Label("History", systemImage: "clock.fill")
                }

            SettingsView()
                .tabItem {
                    Label("Settings", systemImage: "gearshape.fill")
                }
        }
        .tint(Color("PrimaryBlue"))
    }
}
