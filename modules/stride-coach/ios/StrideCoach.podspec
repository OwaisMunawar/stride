require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'StrideCoach'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = 'Owais Munawwar'
  s.homepage       = 'https://github.com/OwaisMunawar/stride'
  s.platforms      = { :ios => '17.0' }
  s.swift_version  = '6.0'
  s.source         = { git: 'https://github.com/OwaisMunawar/stride.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Weak so the module still loads on iOS 17-25, where the framework does not exist.
  s.weak_frameworks = 'FoundationModels'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,mm,swift}'
end
