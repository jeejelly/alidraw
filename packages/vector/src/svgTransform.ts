/** 2D affine matrices and the SVG `transform` attribute. */
export type Matrix = [number, number, number, number, number, number];
export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

export const mul = (left: Matrix, right: Matrix): Matrix => [
  left[0] * right[0] + left[2] * right[1],
  left[1] * right[0] + left[3] * right[1],
  left[0] * right[2] + left[2] * right[3],
  left[1] * right[2] + left[3] * right[3],
  left[0] * right[4] + left[2] * right[5] + left[4],
  left[1] * right[4] + left[3] * right[5] + left[5],
];

export const apply = (
  matrix: Matrix,
  x: number,
  y: number,
): [number, number] => [
  matrix[0] * x + matrix[2] * y + matrix[4],
  matrix[1] * x + matrix[3] * y + matrix[5],
];
export const applyVec = (
  matrix: Matrix,
  x: number,
  y: number,
): [number, number] => [
  matrix[0] * x + matrix[2] * y,
  matrix[1] * x + matrix[3] * y,
];

export const numbers = (text: string) =>
  (text.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number);

export const parseTransform = (value: string | null): Matrix => {
  let matrix = IDENTITY;
  if (!value) {
    return matrix;
  }
  for (const [, name, args] of value.matchAll(/(\w+)\s*\(([^)]*)\)/g)) {
    const values = numbers(args);
    let result: Matrix = IDENTITY;
    switch (name) {
      case "matrix":
        if (values.length === 6) {
          result = values as Matrix;
        }
        break;
      case "translate":
        result = [1, 0, 0, 1, values[0] ?? 0, values[1] ?? 0];
        break;
      case "scale":
        result = [values[0] ?? 1, 0, 0, values[1] ?? values[0] ?? 1, 0, 0];
        break;
      case "rotate": {
        const radians = ((values[0] ?? 0) * Math.PI) / 180;
        const cos = Math.cos(radians);
        const sin = Math.sin(radians);
        const rot: Matrix = [cos, sin, -sin, cos, 0, 0];
        result =
          values.length >= 3
            ? mul(mul([1, 0, 0, 1, values[1], values[2]], rot), [
                1,
                0,
                0,
                1,
                -values[1],
                -values[2],
              ])
            : rot;
        break;
      }
      case "skewX":
        result = [1, 0, Math.tan(((values[0] ?? 0) * Math.PI) / 180), 1, 0, 0];
        break;
      case "skewY":
        result = [1, Math.tan(((values[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0];
        break;
    }
    matrix = mul(matrix, result);
  }
  return matrix;
};

export const scaleOf = (matrix: Matrix) =>
  Math.sqrt(Math.abs(matrix[0] * matrix[3] - matrix[1] * matrix[2])) || 1;
export const isAxisAligned = (matrix: Matrix) =>
  Math.abs(matrix[1]) < 1e-9 && Math.abs(matrix[2]) < 1e-9;
