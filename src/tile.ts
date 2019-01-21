// Copyright (c) 2018-2019 Eon S. Jeon <esjeon@hyunmu.am>
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the "Software"),
// to deal in the Software without restriction, including without limitation
// the rights to use, copy, modify, merge, publish, distribute, sublicense,
// and/or sell copies of the Software, and to permit persons to whom the
// Software is furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL
// THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
// DEALINGS IN THE SOFTWARE.

class Tile implements ITile {
    /* read-only */
    public get actualGeometry(): Rect { return Rect.from(this.client.geometry); }
    public get class(): string { return String(this.client.resourceClass); }
    public get fullScreen(): boolean { return this.client.fullScreen; }
    public get modal(): boolean { return this.client.modal; }

    public get special(): boolean {
        return (
            this.client.specialWindow ||
            String(this.client.resourceClass) === "plasmashell"
        );
    }

    public get tileable(): boolean {
        return (
            (!this.client.fullScreen) &&
            (!this.float)
        );
    }

    public get utility(): boolean {
        return (this.client.dialog || this.client.splash || this.client.utility);
    }

    /* read-write */
    public error: boolean;
    public float: boolean;
    public floatGeometry: Rect;
    public geometry: Rect;
    public hideBorder: boolean;
    public keepBelow: boolean;
    public managed: boolean;

    public client: KWin.Client;

    private arrangeCount: number;
    private padWidth: number;
    private padHeight: number;

    constructor(client: KWin.Client) {
        this.error = false;
        this.float = false;
        this.floatGeometry = Rect.from(client.geometry);
        this.geometry = Rect.from(client.geometry);
        this.hideBorder = false;
        this.keepBelow = false;
        this.managed = false;

        this.client = client;

        this.arrangeCount = 0;
        this.padWidth = 0;
        this.padHeight = 0;
    }

    /*
     * Attributes
     */

    /*
     * Methods
     */

    public commit(reset?: boolean) {
        this.client.keepBelow = this.keepBelow;
        this.client.noBorder = this.hideBorder;

        if (this.float) {
            this.client.geometry = this.floatGeometry.toQRect();
            return;
        }

        /* HACK: prevent infinite `geometryChanged`. */
        this.arrangeCount = (!!reset) ? 0 : this.arrangeCount + 1;
        if (this.arrangeCount > 5) // TODO: define arbitrary constant
            return;

        /* do not commit if not actually changed */
        if (!this.isGeometryChanged()) {
            this.arrangeCount = 0;
            return;
        }

        debugObj(() => ["commitGeometry", {client: this.client, from: this.client.geometry, to: this.geometry}]);
        this.client.geometry = this.geometry.toQRect();
    }

    public isGeometryChanged(): boolean {
        return !this.geometry.equals(this.client.geometry);
    }

    public isVisible(screen: number): boolean {
        try {
            return (
                (!this.client.minimized) &&
                (this.client.desktop === workspace.currentDesktop
                    || this.client.desktop === -1 /* on all desktop */) &&
                (this.client.activities.length === 0 /* on all activities */
                    || this.client.activities.indexOf(workspace.currentActivity) !== -1) &&
                (this.client.screen === screen)
            );
        } catch (e) {
            this.error = true;
            return false;
        }
    }

    public setGeometry(x: number, y: number, width: number, height: number) {
        this.geometry.set(x, y, width, height);
        this.adjustGeometry();
    }

    public setGeometryRect(geometry: IRect) {
        this.geometry.copyFrom(geometry);
        this.adjustGeometry();
    }

    public toggleFloat() {
        this.float = !this.float;
        if (this.float === false)
            this.floatGeometry.copyFrom(this.client.geometry);
        else
            this.commit();
    }

    public toString(): string {
        return "Tile(id=" + this.client.windowId + ", class=" + this.class + ")";
    }

    /*
     * Private Methods
     */

    private adjustGeometry() {
        /* respect resize increment */
        const unit = this.client.basicUnit;
        if (!(unit.width === 1 && unit.height === 1)) /* NOT free-size */ {
            this.adjustPadding();

            const geom = this.geometry;
            const base = this.client.minSize;

            const nw = Math.floor((geom.width  - base.width  - this.padWidth ) / unit.width);
            const nh = Math.floor((geom.height - base.height - this.padHeight) / unit.height);
            this.geometry.width  = base.width  + unit.width  * nw + this.padWidth;
            this.geometry.height = base.height + unit.height * nh + this.padHeight;

            const pw = this.padWidth;
            const ph = this.padHeight;
            debugObj(() => ["commitGometry", {geom, base, unit, pw, ph}]);
        }

        /* do not resize fixed-size windows */
        if (!this.client.resizeable) {
            this.geometry.width = this.client.geometry.width;
            this.geometry.height = this.client.geometry.height;
        }

        /* respect min/max size limit */
        this.geometry.width  = clip(this.client.minSize.width , this.geometry.width , this.client.maxSize.width );
        this.geometry.height = clip(this.client.minSize.height, this.geometry.height, this.client.maxSize.height);
    }

    private adjustPadding() {
        const size = this.client.clientSize;
        this.padWidth = this.client.geometry.width - size.width;
        this.padHeight = this.client.geometry.height - size.height;
        debugObj(() => ["adjustPadding", {size, w: this.padWidth, h: this.padHeight}]);
    }

}