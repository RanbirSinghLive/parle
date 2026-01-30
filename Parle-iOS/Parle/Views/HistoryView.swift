import SwiftUI

/// Session history with expandable details.
///
/// Port of app/history/page.tsx.
struct HistoryView: View {
    @EnvironmentObject var authVM: AuthViewModel
    @State private var sessions: [Session] = []
    @State private var isLoading = true
    @State private var expandedId: String?

    var body: some View {
        Group {
            if isLoading {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if sessions.isEmpty {
                emptyState
            } else {
                sessionList
            }
        }
        .navigationTitle("History")
        .navigationBarTitleDisplayMode(.inline)
        .background(Color(.systemGroupedBackground))
        .task {
            await fetchSessions()
        }
    }

    // MARK: - Empty State

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "bubble.left.and.bubble.right")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text("No sessions yet")
                .font(.headline)
            Text("Start a conversation to see your history here")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Session List

    private var sessionList: some View {
        ScrollView {
            LazyVStack(spacing: 12) {
                ForEach(sessions) { session in
                    sessionCard(session)
                }
            }
            .padding()
        }
    }

    private func sessionCard(_ session: Session) -> some View {
        let isExpanded = expandedId == session.id

        return VStack(spacing: 0) {
            // Header (tappable)
            Button {
                withAnimation(.easeInOut(duration: 0.2)) {
                    expandedId = isExpanded ? nil : session.id
                }
            } label: {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(session.formattedDate)
                            .font(.body.weight(.medium))
                            .foregroundStyle(.primary)
                        Text("\(session.formattedTime) \(session.summary != nil ? "· \(session.summary!.durationMinutes) min" : "")\(session.lessonTopic != nil ? " · \(session.lessonTopic!)" : "")")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }

                    Spacer()

                    if let summary = session.summary {
                        VStack(alignment: .trailing, spacing: 2) {
                            Text("\(summary.correctionsCount) corrections")
                                .font(.subheadline)
                                .foregroundStyle(Color("PrimaryBlue"))
                            Text("\(summary.newVocabulary.count) new words")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }

                    Image(systemName: "chevron.down")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .rotationEffect(.degrees(isExpanded ? 180 : 0))
                }
                .padding()
            }

            // Expanded details
            if isExpanded, let summary = session.summary {
                Divider()
                VStack(alignment: .leading, spacing: 16) {
                    // Highlights
                    VStack(alignment: .leading, spacing: 4) {
                        Text("HIGHLIGHTS")
                            .font(.caption.bold())
                            .foregroundStyle(.secondary)
                        Text(summary.highlights)
                            .font(.subheadline)
                    }

                    // New Vocabulary
                    if !summary.newVocabulary.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("NEW VOCABULARY")
                                .font(.caption.bold())
                                .foregroundStyle(.secondary)
                            FlowLayout(spacing: 6) {
                                ForEach(summary.newVocabulary) { vocab in
                                    Text(vocab.word)
                                        .font(.caption)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 4)
                                        .background(Color("PrimaryBlue").opacity(0.1))
                                        .foregroundStyle(Color("PrimaryBlue"))
                                        .clipShape(Capsule())
                                }
                            }
                        }
                    }

                    // Grammar
                    if !summary.practicedGrammar.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            Text("GRAMMAR PRACTICED")
                                .font(.caption.bold())
                                .foregroundStyle(.secondary)
                            ForEach(summary.practicedGrammar, id: \.self) { grammar in
                                Label(grammar, systemImage: "circle.fill")
                                    .font(.subheadline)
                                    .labelStyle(BulletLabelStyle())
                            }
                        }
                    }
                }
                .padding()
                .transition(.opacity)
            }
        }
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.05), radius: 2, y: 1)
    }

    // MARK: - Data

    private func fetchSessions() async {
        guard let userId = authVM.userId else { return }
        do {
            sessions = try await SupabaseService.shared.fetchSessions(userId: userId)
        } catch {
            print("[HistoryView] Failed to fetch sessions: \(error)")
        }
        isLoading = false
    }
}

// MARK: - Flow Layout (for vocabulary badges)

struct FlowLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let result = layout(proposal: proposal, subviews: subviews)
        return result.size
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let result = layout(proposal: proposal, subviews: subviews)
        for (index, position) in result.positions.enumerated() {
            subviews[index].place(
                at: CGPoint(x: bounds.minX + position.x, y: bounds.minY + position.y),
                proposal: ProposedViewSize(result.sizes[index])
            )
        }
    }

    private struct LayoutResult {
        var size: CGSize
        var positions: [CGPoint]
        var sizes: [CGSize]
    }

    private func layout(proposal: ProposedViewSize, subviews: Subviews) -> LayoutResult {
        let maxWidth = proposal.width ?? .infinity
        var positions: [CGPoint] = []
        var sizes: [CGSize] = []
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            sizes.append(size)

            if x + size.width > maxWidth && x > 0 {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }

            positions.append(CGPoint(x: x, y: y))
            rowHeight = max(rowHeight, size.height)
            x += size.width + spacing
        }

        return LayoutResult(
            size: CGSize(width: maxWidth, height: y + rowHeight),
            positions: positions,
            sizes: sizes
        )
    }
}
