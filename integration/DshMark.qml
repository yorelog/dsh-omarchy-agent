import QtQuick

// The plugin mark: a hexagonal harness fitting around a prompt caret.
//
// The hexagon is the harness — the socket a model is strapped into — and the
// caret is the terminal prompt the panel opens. Drawn natively instead of
// loaded from icon.svg because bar slots are 16px and a rasterised SVG smears
// its strokes at that size; the same geometry then works from 16px in the bar
// to the hero in the panel and the 96px mark in the README.
//
// Two renditions share one silhouette: `filled` is the solid badge used for
// the app mark, and the outline is what the bar shows. The filled caret is cut
// out of the badge rather than painted in a background colour, so the mark
// sits on light, dark, and translucent bars alike.
Item {
  id: root

  property color color: "#ffffff"
  property bool filled: true
  // Brand gradient for the app mark. Off in the bar, where the icon follows
  // the bar foreground like every other glyph.
  property bool gradient: false

  // Everything below is authored on a 64-unit grid and scaled to the item, so
  // the mark stays optically identical at every size.
  readonly property real unit: 64

  implicitWidth: 16
  implicitHeight: 16

  onColorChanged: canvas.requestPaint()
  onFilledChanged: canvas.requestPaint()
  onGradientChanged: canvas.requestPaint()
  onWidthChanged: canvas.requestPaint()
  onHeightChanged: canvas.requestPaint()

  Canvas {
    id: canvas
    anchors.fill: parent
    antialiasing: true

    onPaint: {
      var ctx = getContext("2d")
      ctx.reset()

      var size = Math.min(width, height)
      if (size <= 0) return

      ctx.scale(size / root.unit, size / root.unit)

      var cx = 32
      var cy = 32
      var radius = root.filled ? 27 : 26
      var caretWidth = 7

      function traceHexagon() {
        ctx.beginPath()
        for (var i = 0; i < 6; i++) {
          var angle = (-90 + 60 * i) * Math.PI / 180
          var x = cx + radius * Math.cos(angle)
          var y = cy + radius * Math.sin(angle)
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.closePath()
      }

      function traceCaret() {
        ctx.beginPath()
        ctx.moveTo(25, 21.5)
        ctx.lineTo(40, 32)
        ctx.lineTo(25, 42.5)
      }

      if (root.filled) {
        var fill = root.color
        if (root.gradient) {
          fill = ctx.createLinearGradient(10, 54, 54, 10)
          fill.addColorStop(0, "#41E1AC")
          fill.addColorStop(0.45, "#5AA7FF")
          fill.addColorStop(1, "#A78BFA")
        }

        traceHexagon()
        ctx.fillStyle = fill
        ctx.fill()

        // Punch the caret out of the badge so the surface behind it shows
        // through, whichever theme or bar background that happens to be.
        ctx.globalCompositeOperation = "destination-out"
        ctx.lineWidth = caretWidth
        ctx.lineCap = "round"
        ctx.lineJoin = "round"
        traceCaret()
        ctx.stroke()
        ctx.globalCompositeOperation = "source-over"
        return
      }

      ctx.strokeStyle = root.color
      ctx.lineWidth = 6
      ctx.lineCap = "round"
      ctx.lineJoin = "round"
      traceHexagon()
      ctx.stroke()

      ctx.lineWidth = 6.5
      traceCaret()
      ctx.stroke()
    }
  }
}
