// @flow

export type CrossFaded<T> = {
    from: T,
    to: T,
    min: T,
    mid: T,
    max: T,
    fromScale: number,
    toScale: number,
    t: number
};
