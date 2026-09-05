# Visual reference

`concept.png` was produced with built-in Image Gen. Brief: a complete 400×1280 portrait Hermes activity hub matching the case dashboard; dark #0b1012 canvas, #121b1f panels, mint #9be9b5 and blue #64a7ff; orbital connectivity visual; three platform rows; three recent sessions; two scheduled jobs; fixed Overview / Sessions / Jobs / Activity touch navigation; clearly labelled synthetic data.

Implementation uses native SVG for the orbital diagram, Lucide icons, locally bundled DM Sans/Space Grotesk, consistent panels/rows and full-width touch controls. The same component system extends to session search/filter/detail, job detail and the metadata activity log. Token handling never appears as an editable product control.

Intentional adaptations: generated decorative brand replaced by a Lucide Zap; icon family unified; job times follow actual fixture/upstream timestamps instead of static concept text; connection details are available by tapping the whole row; future/unknown/failure states remain factual. The overview holds to a bounded sample so 400×1280 needs no scrolling. Other views scroll when content requires it.
