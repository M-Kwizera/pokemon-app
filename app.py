import json
import logging
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

from flask import Flask, abort, jsonify, request, send_from_directory, url_for


PROJECT_ROOT = Path(__file__).resolve().parent
POKEAPI_BASE_URL = "https://pokeapi.co/api/v2"
UPSTREAM_TIMEOUT_SECONDS = 10

app = Flask(__name__, static_folder=None)


def fetch_pokeapi(path, params=None):
    query = f"?{urlencode(params)}" if params else ""
    url = f"{POKEAPI_BASE_URL}/{path.lstrip('/')}{query}"
    upstream_request = Request(url, headers={"User-Agent": "Pokemon-Pokedex/1.0"})

    try:
        with urlopen(upstream_request, timeout=UPSTREAM_TIMEOUT_SECONDS) as response:
            return json.load(response)
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as error:
        app.logger.warning("PokéAPI request failed: %s", error)
        abort(502, description="PokéAPI is unavailable. Please try again shortly.")


@app.get("/")
def home():
    return send_from_directory(PROJECT_ROOT, "index.html")


@app.get("/style.css")
def stylesheet():
    return send_from_directory(PROJECT_ROOT, "style.css")


@app.get("/script.js")
def javascript():
    return send_from_directory(PROJECT_ROOT, "script.js")


@app.get("/health")
def health():
    return jsonify(status="ok")


@app.get("/api/pokemon")
def pokemon_list():
    try:
        limit = int(request.args.get("limit", "24"))
        offset = int(request.args.get("offset", "0"))
    except ValueError:
        abort(400, description="Limit and offset must be whole numbers.")

    if not 1 <= limit <= 100 or offset < 0:
        abort(400, description="Limit must be 1–100 and offset cannot be negative.")

    data = fetch_pokeapi("pokemon", {"limit": limit, "offset": offset})
    results = []
    for pokemon in data["results"]:
        try:
            pokemon_id = int(urlparse(pokemon["url"]).path.rstrip("/").split("/")[-1])
        except (KeyError, ValueError, IndexError) as error:
            app.logger.warning("PokéAPI returned an invalid Pokémon entry: %s", error)
            abort(502, description="PokéAPI returned an invalid Pokémon entry.")
        results.append({
            "name": pokemon["name"],
            "url": url_for("pokemon_detail", pokemon_id=pokemon_id),
        })

    return jsonify(count=data["count"], results=results)


@app.get("/api/pokemon/<int:pokemon_id>")
def pokemon_detail(pokemon_id):
    if pokemon_id < 1:
        abort(404, description="Pokémon not found.")
    return jsonify(fetch_pokeapi(f"pokemon/{pokemon_id}"))


@app.errorhandler(400)
@app.errorhandler(404)
@app.errorhandler(502)
def api_error(error):
    if request.path.startswith("/api/"):
        return jsonify(error=error.description), error.code
    return error


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    app.run(host="127.0.0.1", port=5000, debug=True)
