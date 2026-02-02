import SwiftUI

/// Post-session results screen.
///
/// Port of components/SessionSummary.tsx.
struct SessionSummaryView: View {
    let summary: SessionSummary
    let onStartNew: () -> Void
    let onGoToDashboard: () -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Header
                VStack(spacing: 12) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 56))
                        .foregroundStyle(.green)

                    Text("Session Complete!")
                        .font(.title.bold())

                    Text("\(summary.durationMinutes) minutes of practice")
                        .foregroundStyle(.secondary)
                }
                .padding(.top, 24)

                // Highlights
                cardSection(title: "HIGHLIGHTS") {
                    Text(summary.highlights)
                        .foregroundStyle(.secondary)
                }

                // Stats Grid
                HStack(spacing: 16) {
                    statCard(value: "\(summary.correctionsCount)", label: "Corrections")
                    statCard(value: "\(summary.newVocabulary.count)", label: "New Words")
                }

                // New Vocabulary
                if !summary.newVocabulary.isEmpty {
                    cardSection(title: "NEW VOCABULARY") {
                        VStack(alignment: .leading, spacing: 8) {
                            ForEach(summary.newVocabulary) { vocab in
                                HStack {
                                    Text(vocab.word)
                                        .fontWeight(.medium)
                                    Text("—")
                                        .foregroundStyle(.secondary)
                                    Text(vocab.translation)
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                    }
                }

                // Grammar Practiced
                if !summary.practicedGrammar.isEmpty {
                    cardSection(title: "GRAMMAR PRACTICED") {
                        VStack(alignment: .leading, spacing: 6) {
                            ForEach(summary.practicedGrammar, id: \.self) { grammar in
                                Label(grammar, systemImage: "circle.fill")
                                    .font(.subheadline)
                                    .labelStyle(BulletLabelStyle())
                            }
                        }
                    }
                }

                // Recommended Focus
                if !summary.recommendedFocus.isEmpty {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("FOCUS NEXT TIME")
                            .font(.caption.bold())
                            .foregroundStyle(.orange)
                        VStack(alignment: .leading, spacing: 6) {
                            ForEach(summary.recommendedFocus, id: \.self) { focus in
                                Label(focus, systemImage: "circle.fill")
                                    .font(.subheadline)
                                    .foregroundStyle(.orange)
                                    .labelStyle(BulletLabelStyle())
                            }
                        }
                    }
                    .padding()
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.orange.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }

                // Action Buttons
                VStack(spacing: 12) {
                    Button(action: onStartNew) {
                        Text("Start New Session")
                            .font(.headline)
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(Color.primaryBlue)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }

                    Button(action: onGoToDashboard) {
                        Text("Back to Dashboard")
                            .font(.headline)
                            .foregroundStyle(.primary)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 14)
                            .background(Color(.systemGray5))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                }
                .padding(.top, 8)
            }
            .padding()
        }
    }

    // MARK: - Helpers

    private func cardSection<Content: View>(title: String, @ViewBuilder content: () -> Content) -> some View {
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

    private func statCard(value: String, label: String) -> some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.title.bold())
                .foregroundStyle(Color.primaryBlue)
            Text(label)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.05), radius: 2, y: 1)
    }
}

// MARK: - Bullet Label Style

struct BulletLabelStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 8) {
            configuration.icon
                .font(.system(size: 6))
            configuration.title
        }
    }
}
