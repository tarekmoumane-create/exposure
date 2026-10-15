import { Href, Link } from 'expo-router';
import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { type ComponentProps } from 'react';
import { Linking } from 'react-native';

type Props = Omit<ComponentProps<typeof Link>, 'href'> & { href: Href & string };

export function ExternalLink({ href, ...rest }: Props) {
  return (
    <Link
      target="_blank"
      {...rest}
      href={href}
      onPress={async (event) => {
        if (process.env.EXPO_OS !== 'web') {
          // Prevent the default behavior of linking to the default browser on native.
          event.preventDefault();
          // Web pages open in the in-app browser; anything else (mailto:, app links) goes to the system.
          if (/^https?:/i.test(href)) {
            await openBrowserAsync(href, { presentationStyle: WebBrowserPresentationStyle.AUTOMATIC });
          } else {
            await Linking.openURL(href);
          }
        }
      }}
    />
  );
}
