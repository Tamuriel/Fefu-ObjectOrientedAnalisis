export type RGBA = { r: number; g: number; b: number; a: number };

export type LineAlg = 'bresenham' | 'wu';

// TODO: Реализуйте функцию ограничения значения байта (от 0 до 255)
export function clampByte(v: number): number 
{
    return Math.min(255, Math.max(0, v));
}

// TODO: Реализуйте парсинг HEX-строки (например, "#FF0000" или "#F00") в объект RGBA
export function hexToRGBA(hex: string, alpha = 255): RGBA 
{
    const shortMatch = hex.match(/^#?([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/);
    if (shortMatch)
    {
        const r = parseInt(shortMatch[1] + shortMatch[1], 16);
        const g = parseInt(shortMatch[2] + shortMatch[2], 16);
        const b = parseInt(shortMatch[3] + shortMatch[3], 16);
        const a = alpha;
        return { r, g, b, a };
    }

    const longMatch = hex.match(/^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})?$/);
    if (longMatch)
    {
        const r = parseInt(longMatch[1], 16);
        const g = parseInt(longMatch[2], 16);
        const b = parseInt(longMatch[3], 16);
        const a = alpha;
        return { r, g, b, a };
    }

    throw new Error('Invalid Hex format');
}

export class RasterRenderer {
    private ctx: CanvasRenderingContext2D;
    private imageData: ImageData | null = null;
    private buf!: Uint8ClampedArray;

    width = 0; // физические пиксели
    height = 0; // физические пиксели
    dpr = 1;

    private canvas: HTMLCanvasElement;
    private _onWindowResize: () => void;
    private lineAlg: LineAlg = 'bresenham';

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('No 2D context');
        }

        this.ctx = ctx;
        this._onWindowResize = () => this.resize();
        window.addEventListener('resize', this._onWindowResize);

        this.resize();
    }

    dispose() {
        window.removeEventListener('resize', this._onWindowResize);
    }

    setLineAlgorithm(a: LineAlg) {
        this.lineAlg = a;
    }

    getLineAlgorithm(): LineAlg {
        return this.lineAlg;
    }

    // Управляющий метод рисования линий
    drawLine(x0: number, y0: number, x1: number, y1: number, color: RGBA) {
        if (this.lineAlg === 'wu') {
            this.drawLineWu(x0, y0, x1, y1, color);
        } 

        else {
            this.drawLineBrassenham(x0, y0, x1, y1, color);
        }
    }

    // ===================================================================
    // ЗАДАЧА: РЕАЛИЗОВАТЬ МЕТОДЫ НИЖЕ
    // ===================================================================

    // TODO: Вычисление 1D индекса в массиве buf по 2D координатам (x, y)
    // См. формулу в пункте 1.1
    private idx(x: number, y: number): number {
        return ((y * this.width + x) * 4);
    }

    private inBounds(x: number, y: number): boolean {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }

    // TODO: Установка одного пикселя.
    // Получите индекс через this.idx и запишите RGBA компоненты в this.buf
    setPixel(x: number, y: number, color: RGBA) {
        if (!this.inBounds(x, y)) {
            return;
        }

        let offset = this.idx(x, y);
        const keys = ['r', 'g', 'b', 'a'] as const;

        for (const key of keys) {
            this.buf[offset++] = color[key];
        }
    }

    // TODO: Альфа-блендинг См. пункт 1.4
    // Учтите alphaFactor для алгоритма Ву.
    private blendPixel(x: number, y: number, color: RGBA, alphaFactor = 1) {
        if (!this.inBounds(x, y)) {
            return;
        }

        let offset = this.idx(x, y);

        const dstR = this.buf[offset + 0];
        const dstG = this.buf[offset + 1];
        const dstB = this.buf[offset + 2];
        const dstA = this.buf[offset + 3] / 255;

        const srcAlpha = (color.a / 255) * alphaFactor;
        const invAlpha = 1 - srcAlpha;

        this.buf[offset + 0] = clampByte(Math.round(color.r * srcAlpha + dstR * invAlpha));
        this.buf[offset + 1] = clampByte(Math.round(color.g * srcAlpha + dstG * invAlpha));
        this.buf[offset + 2] = clampByte(Math.round(color.b * srcAlpha + dstB * invAlpha));
        this.buf[offset + 3] = clampByte(Math.round((srcAlpha + dstA * invAlpha) * 255));
    }

    // TODO: Жизненный цикл кадра. См. пункт 2.1
    // Учтите devicePixelRatio (dpr). Создайте новый ImageData.
    resize() {
        const rect = this.canvas.getBoundingClientRect();
        const clientWidth = Math.max(1, Math.floor(rect.width));
        const clientHeight = Math.max(1, Math.floor(rect.height));

        if (clientWidth === 0 || clientHeight === 0) {
            return;
        }

        this.dpr = window.devicePixelRatio || 1;

        const maxSize = 4096;
        this.width = Math.min(maxSize, Math.max(1, Math.floor(clientWidth * this.dpr)));
        this.height = Math.min(maxSize, Math.max(1, Math.floor(clientHeight * this.dpr)));

        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.canvas.style.width = `${clientWidth}px`;
        this.canvas.style.height = `${clientHeight}px`;

        this.imageData = this.ctx.createImageData(this.width, this.height);
        this.buf = this.imageData.data;
    }

    // TODO: Очистка буфера. Заполните this.buf нулями, если clear = true
    beginFrame(clear = true) {
        if (clear)
            this.buf.fill(0);
    }

    // TODO: Вывод буфера на экран. Используйте this.ctx.putImageData
    commit() {
        if (this.imageData && this.width > 0 && this.height > 0) {
            this.ctx.putImageData(this.imageData, 0, 0);
        }
    }

    // TODO: Алгоритм Брезенхема. См. пункт 1.5
    // Используйте this.setPixel для отрисовки
    drawLineBrassenham(x0: number, y0: number, x1: number, y1: number, color: RGBA) {
        let dx = Math.abs(x1 - x0);
        let dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;

        let x = x0;
        let y = y0;

        while (true) {
            this.setPixel(x, y, color);

            if (x === x1 && y === y1) break;

            const e2 = 2 * err;
            if (e2 > -dy) 
            {
                err -= dy;
                x += sx;
            }
            if (e2 < dx)
            {
                err += dx;
                y += sy;
            }
        }
    }

    // TODO: Алгоритм Сяолиня Ву. См. пункт 1.6
    // Обязательно используйте this.blendPixel для отрисовки
    drawLineWu(x0: number, y0: number, x1: number, y1: number, color:
    RGBA) {
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const steep = dy > dx;

        let x = x0, y = y0;
        let xEnd = x1, yEnd = y1;

        if (steep) 
        {
            [x, y] = [y, x];
            [xEnd, yEnd] = [yEnd, xEnd];
        }

        if (x > xEnd) 
        {
            [x, xEnd] = [xEnd, x];
            [y, yEnd] = [yEnd, y];
        }

        const gradient = xEnd === x ? 1 : (yEnd - y) / (xEnd - x);

        const xEnd1 = Math.round(x);
        let yEnd1 = y + gradient * (xEnd1 - x);
        let xGap = 1 - ((x + 0.5) % 1);

        let xPixel1 = xEnd1;
        let yPixel1 = Math.floor(yEnd1);

        if (steep) 
        {
            this.blendPixel(yPixel1, xPixel1, color, 1 - (yEnd1 % 1) * xGap);
            this.blendPixel(yPixel1 + 1, xPixel1, color, (yEnd1 % 1) * xGap);
        } 
        else 
        {
            this.blendPixel(xPixel1, yPixel1, color, 1 - (yEnd1 % 1) * xGap);
            this.blendPixel(xPixel1, yPixel1 + 1, color, (yEnd1 % 1) * xGap);
        }

        let intery = yEnd1 + gradient;

        const xEnd2 = Math.round(xEnd);
        let yEnd2 = yEnd + gradient * (xEnd2 - xEnd);
        xGap = (xEnd + 0.5) % 1;

        let xPixel2 = xEnd2;
        let yPixel2 = Math.floor(yEnd2);

        if (steep) 
        {
            this.blendPixel(yPixel2, xPixel2, color, 1 - (yEnd2 % 1) * xGap);
            this.blendPixel(yPixel2 + 1, xPixel2, color, (yEnd2 % 1) * xGap);
        } 
        else 
        {
            this.blendPixel(xPixel2, yPixel2, color, 1 - (yEnd2 % 1) * xGap);
            this.blendPixel(xPixel2, yPixel2 + 1, color, (yEnd2 % 1) * xGap);
        }

        for (let xPos = xPixel1 + 1; xPos < xPixel2; xPos++) 
        {
            let yPos = Math.floor(intery);
            const yFrac = intery % 1;

            if (steep) 
            {
                this.blendPixel(yPos, xPos, color, 1 - yFrac);
                this.blendPixel(yPos + 1, xPos, color, yFrac);
            } 
            else 
            {
                this.blendPixel(xPos, yPos, color, 1 - yFrac);
                this.blendPixel(xPos, yPos + 1, color, yFrac);
            }

            intery += gradient;
        }
    }

    // TODO: Отрисовка горизонтальной линии (для заливки). См. пункт 2.2
    private drawHSpan(y: number, x0: number, x1: number, color: RGBA) {
        if (y < 0 || y >= this.height) {
            return;
        }

        if (x0 > x1) {
            [x0, x1] = [x1, x0];
        }

        x0 = Math.max(0, Math.min(this.width - 1, x0));
        x1 = Math.max(0, Math.min(this.width - 1, x1));

        for (let x = x0; x <= x1; x++) {
            this.blendPixel(x, y, color);
        }
    }

    // TODO: Заливка многоугольника (Scanline). Используйте drawHSpan
    fillPolygon(points: { x: number; y: number }[], color: RGBA) {
        if (points.length < 3) return;

        let minY = points[0].y;
        let maxY = points[0].y;

        for (const point of points) {
            minY = Math.min(minY, point.y);
            maxY = Math.max(maxY, point.y);
        }

        const edgeTable: Array<{ yMin: number; yMax: number; x: number; dx: number }> = [];

        for (let i = 0; i < points.length; i++) {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];

            if (p1.y === p2.y) continue;

            const [start, end] = p1.y < p2.y ? [p1, p2] : [p2, p1];
            const dy = end.y - start.y;
            const dx = (end.x - start.x) / dy;

            edgeTable.push({
                yMin: start.y,
                yMax: end.y,
                x: start.x,
                dx
            });
        }

        const yStart = Math.max(0, Math.ceil(minY));
        const yEnd = Math.min(this.height - 1, Math.floor(maxY));

        for (let y = yStart; y <= yEnd; y++) {
            const intersections: number[] = [];

            for (const edge of edgeTable) {
                if (y >= edge.yMin && y < edge.yMax) {
                    intersections.push(edge.x + (y - edge.yMin) * edge.dx);
                }
            }

            intersections.sort((a, b) => a - b);

            for (let i = 0; i + 1 < intersections.length; i += 2) {
                const x0 = Math.ceil(intersections[i]);
                const x1 = Math.floor(intersections[i + 1]);
                if (x1 >= x0) {
                    this.drawHSpan(y, x0, x1, color);
                }
            }
        }
    }

    // TODO: Заливка окружности. Используйте drawHSpan
    fillCircle(cx: number, cy: number, radius: number, color: RGBA) {
        const r = Math.round(radius);
        const rSquared = r * r;

        for (let y = -r; y <= r; y++) 
        {
            const ySquared = y * y;
            if (ySquared > rSquared) continue;
            
            const xOffset = Math.sqrt(rSquared - ySquared);
            const x0 = Math.floor(cx - xOffset);
            const x1 = Math.ceil(cx + xOffset);
            this.drawHSpan(Math.round(cy + y), x0, x1, color);
        }
    }

    // TODO: Отрисовка толстого отрезка (прямоугольник + шапки). См. пункт 2.5
    strokeLine(x0: number, y0: number, x1: number, y1: number, color: RGBA, width = 1) {
        const dx = x1 - x0;
        const dy = y1 - y0;
        const lenSq = dx * dx + dy * dy;
        const len = Math.sqrt(lenSq);

        if (len < 0.001) 
        {
            this.fillCircle(x0, y0, width / 2, color);
            return;
        }

        const halfWidth = width / 2;
        const ux = (-dy / len) * halfWidth;
        const uy = (dx / len) * halfWidth;

        const points = [
            { x: x0 + ux, y: y0 + uy },
            { x: x1 + ux, y: y1 + uy },
            { x: x1 - ux, y: y1 - uy },
            { x: x0 - ux, y: y0 - uy }
        ];

        this.fillPolygon(points, color);

        this.fillCircle(x0, y0, halfWidth, color);
        this.fillCircle(x1, y1, halfWidth, color);
    }

    // TODO: Отрисовка контура фигуры. См. пункт 2.5
    strokePolygon(points: { x: number; y: number }[], color: RGBA, width = 1) {
        for (let i = 0; i < points.length; i++) 
        {
            const p1 = points[i];
            const p2 = points[(i + 1) % points.length];
            this.strokeLine(p1.x, p1.y, p2.x, p2.y, color, width);
        }
    }
}