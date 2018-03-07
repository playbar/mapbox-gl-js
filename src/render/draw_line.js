// @flow

const browser = require('../util/browser');
const pixelsToTileUnits = require('../source/pixels_to_tile_units');
const DepthMode = require('../gl/depth_mode');

import type Painter from './painter';
import type SourceCache from '../source/source_cache';
import type LineStyleLayer from '../style/style_layer/line_style_layer';
import type LineBucket from '../data/bucket/line_bucket';
import type {OverscaledTileID} from '../source/tile_id';

module.exports = function drawLine(painter: Painter, sourceCache: SourceCache, layer: LineStyleLayer, coords: Array<OverscaledTileID>) {
    if (painter.renderPass !== 'translucent') return;

    const opacity = layer.paint.get('line-opacity');
    if (opacity.constantOr(1) === 0) return;

    const context = painter.context;
    context.setDepthMode(painter.depthModeForSublayer(0, DepthMode.ReadOnly));
    context.setColorMode(painter.colorModeForRenderPass());

    const linePattern = layer.paint.get('line-pattern');
    const programId =
        layer.paint.get('line-dasharray') ? 'lineSDF' :
        linePattern && linePattern.evaluate() ? 'linePattern' : 'line';

    let prevTileZoom;
    let firstTile = true;

    for (const coord of coords) {
        const tile = sourceCache.getTile(coord);
        const bucket: ?LineBucket = (tile.getBucket(layer): any);
        if (!bucket) continue;

        const programConfiguration = bucket.programConfigurations.get(layer.id);
        const prevProgram = painter.context.program.get();
        const program = painter.useProgram(programId, programConfiguration);
        const programChanged = firstTile || program.program !== prevProgram;
        const tileRatioChanged = prevTileZoom !== tile.tileID.overscaledZ;

        if (programChanged) {
            programConfiguration.setUniforms(painter.context, program, layer.paint, {zoom: painter.transform.zoom});
        }
        drawLineTile(program, painter, tile, bucket, layer, coord, programConfiguration, programChanged, tileRatioChanged);
        prevTileZoom = tile.tileID.overscaledZ;
        firstTile = false;
    }
};

function drawLineTile(program, painter, tile, bucket, layer, coord, programConfiguration, programChanged, tileRatioChanged) {
    const context = painter.context;
    const gl = context.gl;
    const dasharray = layer.paint.get('line-dasharray');
    const linePattern = layer.paint.get('line-pattern');
    const image = linePattern && (linePattern.value.kind === "constant" || linePattern.value.kind === "camera" ) ? linePattern.value.value : undefined;

    let posA, posB, imagePosA, imagePosB;

    const tileRatio = 1 / pixelsToTileUnits(tile, 1, painter.transform.tileZoom);
    if (programChanged || tileRatioChanged) {

        if (dasharray) {
            posA = painter.lineAtlas.getDash(dasharray.from, layer.layout.get('line-cap') === 'round');
            posB = painter.lineAtlas.getDash(dasharray.to, layer.layout.get('line-cap') === 'round');

            const widthA = posA.width * dasharray.fromScale;
            const widthB = posB.width * dasharray.toScale;

            gl.uniform2f(program.uniforms.u_patternscale_a, tileRatio / widthA, -posA.height / 2);
            gl.uniform2f(program.uniforms.u_patternscale_b, tileRatio / widthB, -posB.height / 2);
            gl.uniform1f(program.uniforms.u_sdfgamma, painter.lineAtlas.width / (Math.min(widthA, widthB) * 256 * browser.devicePixelRatio) / 2);

        } else if (bucket.dataDrivenPattern) {
            const size = tile.iconAtlasTexture.size;
            gl.uniform2fv(program.uniforms.u_texsize, size);
        } else if (image) {

            imagePosA = painter.imageManager.getPattern(image.from);
            imagePosB = painter.imageManager.getPattern(image.to);
            if (!imagePosA || !imagePosB) return;
            gl.uniform4f(program.uniforms.u_scale, imagePosA.pixelRatio, tileRatio, image.fromScale, image.toScale);

            const {width, height} = painter.imageManager.getPixelSize();
            gl.uniform2fv(program.uniforms.u_texsize, [width, height]);
        } else if (bucket.dataDrivenPattern) {
            const size = tile.iconAtlasTexture.size;
            gl.uniform2fv(program.uniforms.u_texsize, size);
        }

        gl.uniform2f(program.uniforms.u_gl_units_to_pixels, 1 / painter.transform.pixelsToGLUnits[0], 1 / painter.transform.pixelsToGLUnits[1]);
    }

    if (programChanged) {
        if (dasharray) {
            gl.uniform1i(program.uniforms.u_image, 0);
            context.activeTexture.set(gl.TEXTURE0);
            painter.lineAtlas.bind(context);

            gl.uniform1f(program.uniforms.u_tex_y_a, (posA: any).y);
            gl.uniform1f(program.uniforms.u_tex_y_b, (posB: any).y);
            gl.uniform1f(program.uniforms.u_mix, dasharray.t);
        } else if (bucket.dataDrivenPattern) {
            gl.uniform1i(program.uniforms.u_image, 0);
            context.activeTexture.set(gl.TEXTURE0);
            tile.iconAtlasTexture.bind(gl.NEAREST, gl.CLAMP_TO_EDGE);

            const evaluated = linePattern.evaluate();
            gl.uniform1f(program.uniforms.u_fade, evaluated.t);
            gl.uniform4f(program.uniforms.u_scale, 1, tileRatio, evaluated.fromScale, evaluated.toScale);
        } else if (image) {
            gl.uniform1i(program.uniforms.u_image, 0);
            context.activeTexture.set(gl.TEXTURE0);
            painter.imageManager.bind(context);
            gl.uniform4fv(program.uniforms.u_pattern_a, (imagePosA: any).tl.concat((imagePosA: any).br));
            gl.uniform4fv(program.uniforms.u_pattern_b, (imagePosB: any).tl.concat((imagePosB: any).br));
            gl.uniform1f(program.uniforms.u_fade, image.t);
        } else if (bucket.dataDrivenPattern) {
            gl.uniform1i(program.uniforms.u_image, 0);
            context.activeTexture.set(gl.TEXTURE0);
            tile.iconAtlasTexture.bind(gl.NEAREST, gl.CLAMP_TO_EDGE);
            gl.uniform1f(program.uniforms.u_fade, 1);

        }
    }

    context.setStencilMode(painter.stencilModeForClipping(coord));

    const posMatrix = painter.translatePosMatrix(coord.posMatrix, tile, layer.paint.get('line-translate'), layer.paint.get('line-translate-anchor'));
    gl.uniformMatrix4fv(program.uniforms.u_matrix, false, posMatrix);

    gl.uniform1f(program.uniforms.u_ratio, 1 / pixelsToTileUnits(tile, 1, painter.transform.zoom));
    program.draw(
        context,
        gl.TRIANGLES,
        layer.id,
        bucket.layoutVertexBuffer,
        bucket.indexBuffer,
        bucket.segments,
        programConfiguration,
        bucket.dynamicLineAttributeBuffer);
}
