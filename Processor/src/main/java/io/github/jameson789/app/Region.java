package io.github.jameson789.app;

public class Region {
    private final String name;
    private final int x;
    private final int y;
    private final int width;
    private final int height;

    public Region(String name, int x, int y, int width, int height) {
        this.name = name;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    public String getName() {
        return name;
    }

    public boolean contains(int px, int py) {
        // inclusive left/top, exclusive right/bottom
        return px >= x && py >= y && px < x + width && py < y + height;
    }

    public int getX() { return x; }
    public int getY() { return y; }
    public int getWidth() { return width; }
    public int getHeight() { return height; }
}
