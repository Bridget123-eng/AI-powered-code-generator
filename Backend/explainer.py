from openai import OpenAI

client = OpenAI(api_key="YOUR_API_KEY")

def explain_code(code):

    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {
                "role": "user",
                "content": f"Explain this code line by line:\n{code}"
            }
        ]
    )

    return response.choices[0].message.content