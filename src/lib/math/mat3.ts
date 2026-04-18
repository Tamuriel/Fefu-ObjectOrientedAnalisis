export type Mat3 = [
number, number, number,
number, number, number,
number, number, number
];

export interface Point2D { x: number; y: number; }

export const EPS = 1e-10;

export const mat3 = {
    identity(): Mat3 {
    return [1, 0, 0,  
            0, 1, 0,  
            0, 0, 1];
    },

    multiply(a: Mat3, b: Mat3): Mat3 {
        const result: Mat3 = [0, 0, 0,  0, 0, 0,  0, 0, 0];

        for(let row = 0; row < 3; row++)
            {
                for(let column = 0; column < 3; column++)
                    {
                        let sum = 0;

                        for(let i = 0; i < 3; i++)
                            {
                                sum += a[row * 3 + i] * b[i * 3 + column];
                            }

                            result[row * 3 + column] = sum;
                    }                
            }

        return result;
    },

    translate(tx: number, ty: number): Mat3 {
        return [1, 0, tx,  
                0, 1, ty,  
                0, 0, 1];
    },

    scale(sx: number, sy: number): Mat3 {
        return [sx, 0, 0,  
                0, sy, 0,  
                0, 0, 1];
    },

    rotate(rad: number): Mat3 {
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        return [cos, -sin, 0,  
                sin, cos, 0,  
                0, 0, 1]
    },

    fromTransform(
        tx: number, ty: number,
        rotationRad: number,
        sx: number, sy: number
        ): Mat3 {
        const s = mat3.scale(sx, sy);
        const r = mat3.rotate(rotationRad);
        const t = mat3.translate(tx, ty);

        return mat3.multiply(t, mat3.multiply(r, s)); // матричное умножение T * (R * S)
    },

    transformPoint(m: Mat3, x: number, y: number): Point2D {
        return {
            x: m[0] * x + m[1] * y + m[2],

            y: m[3] * x + m[4] * y + m[5]
        }
    },
    
    invert(m: Mat3): Mat3 | null {
        const a = m[0], b = m[1], tx = m[2];
        const c = m[3], d = m[4], ty = m[5];

        const det = a * d - b * c;

        if (Math.abs(det) < EPS)
            return null;

        const invDet = 1.0 / det;

        return [
            d * invDet,
            -b * invDet,
            (b * ty - d * tx) * invDet,
            -c * invDet,
            a * invDet,
            (c * tx - a * ty) * invDet,
            0, 0, 1
        ];
    }
};