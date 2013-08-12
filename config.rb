# See http://www.compass-style.org/

# On OS X "gem install --user-install compass-notify" to have status messages in the Notification Center
begin
    require 'compass-notify'
rescue LoadError
end

cache_path = "/tmp/compass-cache"

sass_options = {
    :cache_location => "/tmp/sass-cache",
}

relative_assets = true

sass_dir = "src/css"
css_dir = "build"
images_dir = "src/img"
generated_images_dir = "build/img"
javascripts_dir = "src/js"

line_comments = false

on_sprite_saved do |filename|
    system("optipng", "-o7", "-q", filename)
    system("advpng", "-z4", "-q", filename)
end
