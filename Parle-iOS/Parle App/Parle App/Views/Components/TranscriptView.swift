import SwiftUI

/// Scrollable message transcript with auto-scroll.
///
/// Port of components/Transcript.tsx.
struct TranscriptView: View {
    let messages: [Message]
    let isProcessing: Bool

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 12) {
                    if messages.isEmpty {
                        welcomeMessage
                    }

                    ForEach(messages) { message in
                        MessageBubble(message: message)
                            .id(message.id)
                    }

                    if isProcessing {
                        typingIndicator
                            .id("typing")
                    }
                }
                .padding()
            }
            .onChange(of: messages.count) {
                withAnimation(.easeOut(duration: 0.3)) {
                    if isProcessing {
                        proxy.scrollTo("typing", anchor: .bottom)
                    } else if let last = messages.last {
                        proxy.scrollTo(last.id, anchor: .bottom)
                    }
                }
            }
            .onChange(of: isProcessing) {
                if isProcessing {
                    withAnimation {
                        proxy.scrollTo("typing", anchor: .bottom)
                    }
                }
            }
        }
    }

    // MARK: - Welcome

    private var welcomeMessage: some View {
        VStack(spacing: 16) {
            Spacer().frame(height: 60)
            Image(systemName: "mic.fill")
                .font(.system(size: 40))
                .foregroundStyle(Color.primaryBlue.opacity(0.3))
            Text("Hold the button to speak")
                .font(.headline)
                .foregroundStyle(.secondary)
            Text("Your French tutor is ready!")
                .font(.subheadline)
                .foregroundStyle(.tertiary)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Typing Indicator

    private var typingIndicator: some View {
        HStack {
            HStack(spacing: 4) {
                ForEach(0..<3, id: \.self) { i in
                    Circle()
                        .fill(Color.gray.opacity(0.5))
                        .frame(width: 8, height: 8)
                        .animation(
                            .easeInOut(duration: 0.6)
                                .repeatForever()
                                .delay(Double(i) * 0.2),
                            value: isProcessing
                        )
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(Color(.systemGray6))
            .clipShape(RoundedRectangle(cornerRadius: 16))
            Spacer()
        }
    }
}
