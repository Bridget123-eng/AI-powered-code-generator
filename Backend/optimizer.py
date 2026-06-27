from openai import OpenAI

client = OpenAI(api_key="YOUR_API_KEY")

def optimize_code(code):

    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {
                "role": "user",
                "content": f"Optimize this code:\n{code}"
            }
        ]
    )

    return response.choices[0].message.content