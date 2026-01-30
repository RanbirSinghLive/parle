import SwiftUI

/// Dashboard home screen with stats, progress, and session launcher.
///
/// Port of app/dashboard/page.tsx.
struct DashboardView: View {
    @StateObject private var vm = DashboardViewModel()
    @EnvironmentObject var authVM: AuthViewModel

    @State private var showLessonPicker = false

    var body: some View {
        NavigationStack {
            if vm.isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                ScrollView {
                    VStack(spacing: 16) {
                        // Header Card
                        headerCard
                            .padding(.horizontal)

                        // Daily Goal
                        dailyGoalCard
                            .padding(.horizontal)

                        // Start Conversation
                        Button { showLessonPicker = true } label: {
                            Label("Start Conversation", systemImage: "mic.fill")
                                .font(.headline)
                                .foregroundStyle(.white)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 16)
                                .background(Color("PrimaryBlue"))
                                .clipShape(RoundedRectangle(cornerRadius: 16))
                                .shadow(color: Color("PrimaryBlue").opacity(0.3), radius: 8, y: 4)
                        }
                        .padding(.horizontal)

                        // Quick Stats
                        HStack(spacing: 12) {
                            quickStatCard(
                                value: "\(vm.profile?.totalPracticeMinutes ?? 0)",
                                label: "Total Minutes"
                            )
                            quickStatCard(
                                value: "\(vm.recentCorrectionsCount)",
                                label: "Recent Corrections"
                            )
                        }
                        .padding(.horizontal)

                        // Progress Cards
                        progressSection
                            .padding(.horizontal)

                        // Recent Sessions
                        recentSessionsCard
                            .padding(.horizontal)
                    }
                    .padding(.vertical)
                }
                .background(Color(.systemGroupedBackground))
            }
        }
        .task {
            if let userId = authVM.userId {
                await vm.fetchData(userId: userId)
            }
        }
        .sheet(isPresented: $showLessonPicker) {
            LessonPickerView(
                onSelectFreeConversation: {
                    showLessonPicker = false
                    // Navigate to conversation tab
                },
                onSelectLesson: { _ in
                    showLessonPicker = false
                }
            )
        }
    }

    // MARK: - Header

    private var headerCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    Text(vm.greeting)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Text(vm.displayName)
                        .font(.title.bold())
                }
                Spacer()
            }

            HStack(spacing: 16) {
                HStack(spacing: 8) {
                    Image(systemName: "flame.fill")
                        .foregroundStyle(.orange)
                    Text("\(vm.profile?.streakDays ?? 0)")
                        .font(.title2.bold())
                    Text("Day Streak")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }

                Spacer()

                HStack(spacing: 8) {
                    Image(systemName: "book.fill")
                        .foregroundStyle(Color("PrimaryBlue"))
                    Text(vm.profile?.currentLevel ?? "A1")
                        .font(.title2.bold())
                    Text("Level")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.05), radius: 2, y: 1)
    }

    // MARK: - Daily Goal

    private var dailyGoalCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Today's Goal")
                    .font(.headline)
                Spacer()
                Text("\(vm.todayMinutes) / \(vm.dailyGoalMinutes) min")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }

            ProgressView(value: vm.dailyProgress)
                .tint(Color("PrimaryBlue"))

            if vm.dailyProgress >= 1.0 {
                Label("Goal completed!", systemImage: "checkmark.circle.fill")
                    .font(.caption)
                    .foregroundStyle(.green)
            }
        }
        .padding()
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.05), radius: 2, y: 1)
    }

    // MARK: - Quick Stats

    private func quickStatCard(value: String, label: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value)
                .font(.title.bold())
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.05), radius: 2, y: 1)
    }

    // MARK: - Progress Cards

    private var progressSection: some View {
        VStack(spacing: 12) {
            // Trouble Words
            if !vm.troubleWords.isEmpty {
                progressCard(title: "TROUBLE WORDS") {
                    ForEach(vm.troubleWords.prefix(5)) { word in
                        HStack {
                            Text(word.word)
                                .fontWeight(.medium)
                            Text(word.translation)
                                .foregroundStyle(.secondary)
                            Spacer()
                            Text("\(word.timesCorrect)/\(word.timesSeen)")
                                .font(.caption)
                                .foregroundStyle(.orange)
                        }
                    }
                }
            }

            // Weaknesses
            if let weaknesses = vm.profile?.weaknesses, !weaknesses.isEmpty {
                progressCard(title: "AREAS TO IMPROVE") {
                    ForEach(weaknesses.prefix(5), id: \.self) { weakness in
                        Label(weakness, systemImage: "circle.fill")
                            .font(.subheadline)
                            .labelStyle(BulletLabelStyle())
                    }
                }
            }

            // Grammar
            if let grammar = vm.profile?.grammar, !grammar.isEmpty {
                progressCard(title: "GRAMMAR PROGRESS") {
                    ForEach(grammar.sorted(by: { $0.masteryLevel < $1.masteryLevel }).prefix(4)) { entry in
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(entry.rule)
                                    .font(.subheadline.weight(.medium))
                                Text(entry.description)
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                            Spacer()
                            masteryDots(level: entry.masteryLevel)
                        }
                    }
                }
            }

            // Topics
            if !vm.topicSummaries.isEmpty {
                progressCard(title: "TOPICS PRACTICED") {
                    ForEach(vm.topicSummaries.prefix(5)) { topic in
                        HStack {
                            Image(systemName: topic.icon)
                                .foregroundStyle(Color("PrimaryBlue"))
                                .frame(width: 24)
                            Text(topic.topic)
                                .font(.subheadline)
                            Spacer()
                            Text("\(topic.sessionCount) sessions")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }

            // Recommended Focus
            if !vm.recommendedFocus.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("RECOMMENDED FOCUS")
                        .font(.caption.bold())
                        .foregroundStyle(.orange)
                    ForEach(vm.recommendedFocus, id: \.self) { item in
                        Label(item, systemImage: "circle.fill")
                            .font(.subheadline)
                            .foregroundStyle(.orange)
                            .labelStyle(BulletLabelStyle())
                    }
                }
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.orange.opacity(0.1))
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
        }
    }

    private func progressCard<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .font(.caption.bold())
                .foregroundStyle(.secondary)
            content()
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.05), radius: 2, y: 1)
    }

    private func masteryDots(level: Int) -> some View {
        HStack(spacing: 3) {
            ForEach(1...5, id: \.self) { i in
                Circle()
                    .fill(i <= level ? Color("PrimaryBlue") : Color(.systemGray4))
                    .frame(width: 6, height: 6)
            }
        }
    }

    // MARK: - Recent Sessions

    private var recentSessionsCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("Recent Sessions")
                    .font(.headline)
                Spacer()
                NavigationLink("View All") {
                    HistoryView()
                }
                .font(.subheadline)
            }
            .padding()

            if vm.recentSessions.isEmpty {
                Text("No sessions yet. Start practicing!")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding()
            } else {
                Divider()
                ForEach(vm.recentSessions) { session in
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(session.formattedDate)
                                .font(.subheadline.weight(.medium))
                            Text("\(session.summary?.durationMinutes ?? 0) min")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text("\(session.summary?.correctionsCount ?? 0) corrections")
                            .font(.subheadline)
                            .foregroundStyle(Color("PrimaryBlue"))
                    }
                    .padding()
                    Divider()
                }
            }
        }
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.05), radius: 2, y: 1)
    }
}
