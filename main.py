import json
from http.server import HTTPServer, BaseHTTPRequestHandler

rides = [
    {"id": 1, "driver": "Chol", "passenger": "Abay",  "dest": "Kimironko", "pick": "ALU", "status": "active"},
    {"id": 2, "driver": "Marion", "passenger": "Kevin", "dest": "CHIC", "pick": "KABC", "status": "ended"},
]

class MotoTaxiHandler(BaseHTTPRequestHandler):
    def _set_headers(self, status=200, content_type="application/json"):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.end_headers()

# def do_GET(self):
#         # http://localhost:8080/rides
#         if self.path == "/rides":
#             self._set_headers(200)
#             self.wfile.write(json.dumps(rides).encode("utf-8"))
#         else:
#             self._set_headers(404)
#             self.wfile.write(json.dumps({"error": "Path not found!"}).encode("utf-8"))

def do_POST(self):
        if self.path == "/rides":
            content_type = self.headers.get("Content-Type")
            if content_type != "application/json":
                self._set_headers(415)
                self.wfile.write(json.dumps({"error": "Content must be json"}).encode("utf-8"))

            content_length = int(self.headers.get("Content-Length", 0))

            if content_length == 0:
                self._set_headers(400)
                self.wfile.write(json.dumps({"error": "Content must not be empty"}).encode("utf-8"))

            try:
                content = self.rfile.read(content_length)
                data = json.loads(content)

                new_ride = {
                    "id": len(rides) + 1, 
                    "driver": data.get("driver", "Unknown"), 
                    "passenger": data.get("passenger", "Unknown"), 
                    "dest": data.get("dest", "Unknown"), 
                    "pick": data.get("pick", "Unkown"), 
                    "status": "pending"
                }

                rides.append(new_ride)


                self._set_headers(201)
                self.wfile.write(json.dumps(new_ride).encode("utf-8"))
            except json.JSONDecodeError:
                self._set_headers(400)
                self.wfile.write(json.dumps({"error": "Invalid JSON"}).encode("utf-8"))
    
        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "Path not faund!"}).encode("utf-8"))

def do_Patch(self):
    if self.path.startswith("/rides/"):
        ride_id = int(self.path.split("/")[-1])
        ride = next((r for r in rides if r["id"] == ride_id), None)

        if not ride:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "Ride not found"}).encode("utf-8"))
            return

        content_type = self.headers.get("Content-Type")
        if content_type != "application/json":
            self._set_headers(415)
            self.wfile.write(json.dumps({"error": "Content must be json"}).encode("utf-8"))
            return

        content_length = int(self.headers.get("Content-Length", 0))
        if content_length == 0:
            self._set_headers(400)
            self.wfile.write(json.dumps({"error": "Content must not be empty"}).encode("utf-8"))
            return

        try:
            content = self.rfile.read(content_length)
            data = json.loads(content)

            # Update the ride status
            ride["status"] = data.get("status", ride["status"])

            self._set_headers(200)
            self.wfile.write(json.dumps(ride).encode("utf-8"))
        except json.JSONDecodeError:
            self._set_headers(400)
            self.wfile.write(json.dumps({"error": "Invalid JSON"}).encode("utf-8"))


def run():
    server_address = ("", 8080)
    httpd = HTTPServer(server_address, MotoTaxiHandler)
    print(f"Moto Taxi ==> server running on port {server_address[1]}")
    httpd.serve_forever()


if __name__ == "__main__":
    run()

