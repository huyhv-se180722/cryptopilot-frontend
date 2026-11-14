import { HANDLE_RADIUS, type Figure, type Pixel, type Shape } from './geometry';

const DASHES = { SOLID: [], DASHED: [6, 4], DOTTED: [1.5, 3] } as const;

function arrowHead(
  context: CanvasRenderingContext2D,
  from: Pixel,
  to: Pixel,
  size: number,
) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  context.beginPath();
  context.moveTo(to.x, to.y);
  context.lineTo(
    to.x - size * Math.cos(angle - Math.PI / 7),
    to.y - size * Math.sin(angle - Math.PI / 7),
  );
  context.moveTo(to.x, to.y);
  context.lineTo(
    to.x - size * Math.cos(angle + Math.PI / 7),
    to.y - size * Math.sin(angle + Math.PI / 7),
  );
  context.stroke();
}

function drawShape(context: CanvasRenderingContext2D, shape: Shape) {
  switch (shape.kind) {
    case 'segment': {
      context.strokeStyle = shape.color;
      context.lineWidth = shape.width;
      context.setLineDash([...DASHES[shape.dash]]);
      context.beginPath();
      context.moveTo(shape.from.x, shape.from.y);
      context.lineTo(shape.to.x, shape.to.y);
      context.stroke();
      context.setLineDash([]);
      if (shape.arrow)
        arrowHead(context, shape.from, shape.to, 8 + shape.width * 2);
      return;
    }
    case 'rect': {
      const x = Math.min(shape.from.x, shape.to.x);
      const y = Math.min(shape.from.y, shape.to.y);
      const w = Math.abs(shape.to.x - shape.from.x);
      const h = Math.abs(shape.to.y - shape.from.y);
      if (shape.fill) {
        context.fillStyle = shape.fill;
        context.fillRect(x, y, w, h);
      }
      if (shape.stroke) {
        context.strokeStyle = shape.stroke;
        context.lineWidth = shape.width;
        context.strokeRect(x, y, w, h);
      }
      return;
    }
    case 'polygon': {
      context.fillStyle = shape.fill;
      context.beginPath();
      shape.points.forEach((point, i) =>
        i === 0
          ? context.moveTo(point.x, point.y)
          : context.lineTo(point.x, point.y),
      );
      context.closePath();
      context.fill();
      return;
    }
    case 'text': {
      if (!shape.text) return;
      context.font = `${shape.size}px 'IBM Plex Sans', sans-serif`;
      context.textAlign = shape.align;
      context.textBaseline = shape.baseline;
      if (shape.background) {
        const width = context.measureText(shape.text).width + 8;
        const height = shape.size + 6;
        const x =
          shape.align === 'right'
            ? shape.at.x - width + 4
            : shape.align === 'center'
              ? shape.at.x - width / 2
              : shape.at.x - 4;
        const y =
          shape.baseline === 'bottom'
            ? shape.at.y - height + 3
            : shape.baseline === 'middle'
              ? shape.at.y - height / 2
              : shape.at.y - 3;
        context.fillStyle = shape.background;
        context.fillRect(x, y, width, height);
      }
      context.fillStyle = shape.color;
      context.fillText(shape.text, shape.at.x, shape.at.y);
      return;
    }
  }
}

/** Paints a figure, and its handles when it is selected or being placed. */
export function paintFigure(
  context: CanvasRenderingContext2D,
  figure: Figure,
  options: { handles: boolean; accent: string },
) {
  context.save();
  context.lineCap = 'round';
  for (const shape of figure.shapes) drawShape(context, shape);
  if (options.handles) {
    context.setLineDash([]);
    context.lineWidth = 1.5;
    for (const handle of figure.handles) {
      context.beginPath();
      context.arc(handle.x, handle.y, HANDLE_RADIUS - 1.5, 0, Math.PI * 2);
      context.fillStyle = '#FFFFFF';
      context.fill();
      context.strokeStyle = options.accent;
      context.stroke();
    }
  }
  context.restore();
}
