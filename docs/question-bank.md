# Question Bank

Put your final question data in:

```txt
data/questions.json
```

## Required Shape

```json
[
  {
    "id": "q-001",
    "question": "Question text",
    "options": ["A", "B", "C", "D"],
    "correctOptionId": 1
  }
]
```

## Rules
- `id`: unique string
- `question`: plain text prompt
- `options`: exactly 4 strings
- `correctOptionId`: `0`, `1`, `2`, or `3`

## Keep It Simple
- No timer fields
- No nested answers
- No markdown needed
- No extra metadata required
