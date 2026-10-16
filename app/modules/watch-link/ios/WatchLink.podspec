Pod::Spec.new do |s|
  s.name           = 'WatchLink'
  s.version        = '1.0.0'
  s.summary        = 'Sends config to the paired Apple Watch'
  s.author         = ''
  s.homepage       = 'https://example.com'
  s.license        = { :type => 'Proprietary' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.swift'
end
