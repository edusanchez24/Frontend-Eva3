from rest_framework.renderers import JSONRenderer


class BrowserJSONRenderer(JSONRenderer):
    """Entrega JSON también cuando un navegador solicita text/html."""

    media_type = 'text/html'
    format = 'html'
