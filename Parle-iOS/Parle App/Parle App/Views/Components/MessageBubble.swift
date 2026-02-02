import SwiftUI

/// Individual message bubble in the conversation transcript.
///
/// Port of components/MessageBubble.tsx.
struct MessageBubble: View {
    let message: Message

    var body: some View {
        HStack {
            if message.role == .user { Spacer(minLength: 60) }

            VStack(alignment: message.role == .user ? .trailing : .leading, spacing: 4) {
                Text(message.content)
                    .padding(12)
                    .background(bubbleBackground)
                    .foregroundStyle(message.role == .user ? .white : .primary)
                    .clipShape(RoundedRectangle(cornerRadius: 16))

                HStack(spacing: 6) {
                    if message.correctionCount > 0 {
                        Text("\(message.correctionCount) correction\(message.correctionCount > 1 ? "s" : "")")
                            .font(.caption2)
                            .foregroundStyle(.orange)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color.orange.opacity(0.1))
                            .clipShape(Capsule())
                    }

                    Text(message.formattedTime)
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }
            }

            if message.role == .tutor { Spacer(minLength: 60) }
        }
    }

    private var bubbleBackground: Color {
        message.role == .user
            ? Color.primaryBlue
            : Color(.systemGray6)
    }
}
