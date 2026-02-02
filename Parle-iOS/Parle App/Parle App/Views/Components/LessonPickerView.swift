import SwiftUI

/// Lesson/topic selection sheet.
///
/// Port of components/LessonPicker.tsx.
struct LessonPickerView: View {
    let onSelectFreeConversation: () -> Void
    let onSelectLesson: (String) -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Free Conversation — primary CTA
                    Button(action: onSelectFreeConversation) {
                        HStack(spacing: 12) {
                            Image(systemName: "bubble.left.and.bubble.right.fill")
                                .font(.title)
                            VStack(alignment: .leading) {
                                Text("Free Conversation")
                                    .font(.headline)
                                Text("Chat about anything — your tutor follows your lead")
                                    .font(.caption)
                                    .opacity(0.8)
                            }
                            Spacer()
                        }
                        .padding()
                        .foregroundStyle(.white)
                        .background(
                            LinearGradient(
                                colors: [Color.primaryBlue, Color.primaryBlue.opacity(0.8)],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                        .shadow(color: Color.primaryBlue.opacity(0.3), radius: 8, y: 4)
                    }

                    // Lesson Categories
                    ForEach(lessonCategories) { category in
                        VStack(alignment: .leading, spacing: 8) {
                            Text(category.name.uppercased())
                                .font(.caption.bold())
                                .foregroundStyle(.secondary)
                                .padding(.leading, 4)

                            VStack(spacing: 8) {
                                ForEach(category.topics) { topic in
                                    Button {
                                        onSelectLesson(topic.name)
                                    } label: {
                                        HStack(spacing: 12) {
                                            Image(systemName: topic.icon)
                                                .font(.title2)
                                                .frame(width: 32)
                                                .foregroundStyle(Color.primaryBlue)
                                            Text(topic.name)
                                                .font(.body)
                                                .foregroundStyle(.primary)
                                            Spacer()
                                            Image(systemName: "chevron.right")
                                                .font(.caption)
                                                .foregroundStyle(.tertiary)
                                        }
                                        .padding(12)
                                        .background(Color(.systemGray6))
                                        .clipShape(RoundedRectangle(cornerRadius: 12))
                                    }
                                }
                            }
                        }
                    }
                }
                .padding()
            }
            .navigationTitle("Choose Your Practice")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }
}
