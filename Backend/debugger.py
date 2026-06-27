import subprocess

def debug_python(code):

    try:
        exec(code)
        return {
            "status": "No syntax errors"
        }

    except Exception as e:
        return {
            "status": "Error",
            "message": str(e)
        }