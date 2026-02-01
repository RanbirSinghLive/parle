import Foundation

struct LessonCategory: Identifiable {
    let id = UUID()
    let name: String
    let topics: [LessonTopic]
}

struct LessonTopic: Identifiable {
    let id: String
    let name: String
    let icon: String
}

let lessonCategories: [LessonCategory] = [
    LessonCategory(name: "Basics", topics: [
        LessonTopic(id: "greetings", name: "Greetings & Introductions", icon: "hand.wave.fill"),
        LessonTopic(id: "numbers", name: "Numbers & Time", icon: "number"),
        LessonTopic(id: "weather", name: "Weather & Seasons", icon: "sun.max.fill"),
    ]),
    LessonCategory(name: "Daily Life", topics: [
        LessonTopic(id: "restaurant", name: "At the Restaurant", icon: "fork.knife"),
        LessonTopic(id: "shopping", name: "Shopping & Prices", icon: "bag.fill"),
        LessonTopic(id: "directions", name: "Asking for Directions", icon: "map.fill"),
    ]),
    LessonCategory(name: "Grammar Focus", topics: [
        LessonTopic(id: "passe-compose", name: "Passe Compose", icon: "pencil"),
        LessonTopic(id: "imparfait", name: "Imparfait", icon: "book.fill"),
        LessonTopic(id: "subjunctive", name: "Subjunctive Mood", icon: "target"),
    ]),
    LessonCategory(name: "Conversation", topics: [
        LessonTopic(id: "hobbies", name: "Hobbies & Interests", icon: "paintpalette.fill"),
        LessonTopic(id: "travel", name: "Travel & Vacation", icon: "airplane"),
        LessonTopic(id: "work", name: "Work & Career", icon: "briefcase.fill"),
    ]),
]

// Topic name to SF Symbol mapping for display in cards
let topicIcons: [String: String] = [
    "Free Conversation": "bubble.left.and.bubble.right.fill",
    "Greetings & Introductions": "hand.wave.fill",
    "Numbers & Time": "number",
    "Weather & Seasons": "sun.max.fill",
    "At the Restaurant": "fork.knife",
    "Shopping & Prices": "bag.fill",
    "Asking for Directions": "map.fill",
    "Passe Compose": "pencil",
    "Imparfait": "book.fill",
    "Subjunctive Mood": "target",
    "Hobbies & Interests": "paintpalette.fill",
    "Travel & Vacation": "airplane",
    "Work & Career": "briefcase.fill",
]
