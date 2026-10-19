<?xml version="1.0" encoding="UTF-8"?>
<StyledLayerDescriptor version="1.0.0"
    xmlns="http://www.opengis.net/sld"
    xmlns:ogc="http://www.opengis.net/ogc"
    xmlns:xlink="http://www.w3.org/1999/xlink"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.opengis.net/sld http://schemas.opengis.net/sld/1.0.0/StyledLayerDescriptor.xsd">
  <NamedLayer>
    <Name>validation_style</Name>
    <UserStyle>
      <Name>validation_style</Name>
      <Title>Model vs 2022 flood</Title>
      <Abstract>validation_result.tif: 1 hit, 2 miss, 3 false alarm; other land and nodata are not drawn.</Abstract>
      <FeatureTypeStyle>
        <Rule>
          <RasterSymbolizer>
            <Opacity>0.85</Opacity>
            <ColorMap type="values">
              <ColorMapEntry color="#1b7837" quantity="1" label="Hit"/>
              <ColorMapEntry color="#d6604d" quantity="2" label="Miss"/>
              <ColorMapEntry color="#f4c26b" quantity="3" label="False alarm"/>
            </ColorMap>
          </RasterSymbolizer>
        </Rule>
      </FeatureTypeStyle>
    </UserStyle>
  </NamedLayer>
</StyledLayerDescriptor>
