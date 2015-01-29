# /usr/bin/env python
# encoding: utf-8

import os
import unittest

from selenium import webdriver
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.desired_capabilities import DesiredCapabilities

SELENIUM_REMOTE_URL = os.environ.get('SELENIUM_REMOTE_URL', 'http://127.0.0.1:4444/wd/hub')

TEST_SERVER_URL = 'http://127.0.0.1:8000'


class CoreViewerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.driver = webdriver.Remote(command_executor=SELENIUM_REMOTE_URL,
                                      desired_capabilities=DesiredCapabilities.FIREFOX)

    @classmethod
    def tearDownClass(cls):
        cls.driver.close()

    def setUp(self):
        self.driver.set_window_size(1024, 768)
        self.driver.get('%s/examples/first-folio.html' % TEST_SERVER_URL)
        self.assertIn("First Folio", self.driver.title)

    def __verify_pagination(self, d, move_forward_f, move_backwards_f):
        index_controls = d.find_elements_by_class_name('current-index')
        index_controls.append(d.find_element_by_id('index'))

        for elem in index_controls:
            self.assertEqual(elem.get_attribute('min'), '1')
            self.assertEqual(elem.get_attribute('max'), '461')
            self.assertEqual(elem.get_attribute('value'), '1')

        self.assertIn('disabled', d.find_element_by_css_selector('.page.previous').get_attribute('class'))

        move_forward_f()

        for elem in index_controls:
            self.assertEqual(elem.get_attribute('min'), '1')
            self.assertEqual(elem.get_attribute('max'), '461')
            self.assertEqual(elem.get_attribute('value'), '2')

        self.assertNotIn('disabled', d.find_element_by_css_selector('.page.previous').get_attribute('class'))

        move_backwards_f()

        for elem in index_controls:
            self.assertEqual(elem.get_attribute('min'), '1')
            self.assertEqual(elem.get_attribute('max'), '461')
            self.assertEqual(elem.get_attribute('value'), '1')

        self.assertIn('disabled', d.find_element_by_css_selector('.page.previous').get_attribute('class'))

    def test_pagination_using_arrow_keys(self):
        """Test that navigation using the arrow keys works updates the viewer consistently"""

        d = self.driver

        def move_forward():
            d.find_element_by_id('viewer').send_keys(Keys.ARROW_RIGHT)

        def move_backward():
            d.find_element_by_id('viewer').send_keys(Keys.ARROW_LEFT)

        self.__verify_pagination(d, move_forward, move_backward)

    def test_pagination_using_vim_keys(self):
        """Test that navigation using the arrow keys works updates the viewer consistently"""

        d = self.driver

        def move_forward():
            d.find_element_by_id('viewer').send_keys('j')

        def move_backward():
            d.find_element_by_id('viewer').send_keys('k')

        self.__verify_pagination(d, move_forward, move_backward)

    def test_pagination_using_spacebar(self):
        """Test that navigation using the arrow keys works updates the viewer consistently"""

        d = self.driver

        def move_forward():
            d.find_element_by_id('viewer').send_keys(Keys.SPACE)

        def move_backward():
            d.find_element_by_id('viewer').send_keys(Keys.SHIFT, Keys.SPACE)

        self.__verify_pagination(d, move_forward, move_backward)

    def test_pagination_using_buttons(self):
        """Test that navigation using the next/previous buttons works updates the viewer consistently"""
        d = self.driver

        def move_forward():
            d.find_element_by_css_selector('a.page.next').click()

        def move_backward():
            d.find_element_by_css_selector('a.page.previous').click()

        self.__verify_pagination(d, move_forward, move_backward)

    def test_pagination_using_slider(self):
        """Test that navigation using the next/previous buttons works updates the viewer consistently"""
        d = self.driver

        def move_forward():
            d.find_element_by_id('index').send_keys(Keys.ARROW_RIGHT)

        def move_backward():
            d.find_element_by_id('index').send_keys(Keys.ARROW_LEFT)


        # Set the window size to be large enough that the slider is visible:
        self.driver.set_window_size(1280, 768)

        self.__verify_pagination(d, move_forward, move_backward)

    def test_help(self):
        d = self.driver

        self.assertFalse(d.find_element_by_id('help').is_displayed())

        d.find_element_by_id('viewer').send_keys('?')
        self.assertTrue(d.find_element_by_id('help').is_displayed())

        d.find_element_by_id('viewer').send_keys(Keys.ESCAPE)
        self.assertFalse(d.find_element_by_id('help').is_displayed())

        d.find_element_by_id('toggle-help').click()
        self.assertTrue(d.find_element_by_id('help').is_displayed())

        d.find_element_by_id('viewer').send_keys(Keys.ESCAPE)
        self.assertFalse(d.find_element_by_id('help').is_displayed())

    def test_open_grid(self):
        d = self.driver

        self.assertFalse(d.find_element_by_id('grid').is_displayed())

        d.find_element_by_id('viewer').send_keys('g')
        self.assertTrue(d.find_element_by_id('grid').is_displayed(),
                        'Grid element should visible')
        self.assertFalse(d.find_element_by_id('pages').is_displayed(),
                        'Pages element should not be visible when the grid is open')

    def test_open_zoom(self):
        d = self.driver

        self.assertFalse(d.find_element_by_id('seadragon').is_displayed())

        d.find_element_by_id('viewer').send_keys('z')
        self.assertTrue(d.find_element_by_id('seadragon').is_displayed(),
                        'Seadragon element should visible')
        self.assertFalse(d.find_element_by_id('pages').is_displayed(),
                        'Pages element should not be visible when the grid is open')
        self.assertFalse(d.find_element_by_id('help').is_displayed(),
                        'Help view should not be visible when the grid is open')

    def test_facing_page_display_suppressed(self):
        """The next page should never display on the First Folio because it forces single-page display"""
        d = self.driver

        current_page = d.find_element_by_css_selector('#pages .page.current')
        next_page = d.find_element_by_css_selector('#pages .page.next')

        d.set_window_size(800, 600)
        self.assertTrue(current_page.is_displayed())
        self.assertFalse(next_page.is_displayed())

        d.set_window_size(1280, 400)
        self.assertTrue(current_page.is_displayed())
        self.assertFalse(next_page.is_displayed())

    def test_facing_page_display_normal(self):
        """The next page should display on the Ptolemy scan"""
        d = self.driver
        d.get('%s/examples/ptolemy.html#1/10' % TEST_SERVER_URL)

        current_page = d.find_element_by_css_selector('#pages .page.current')
        next_page = d.find_element_by_css_selector('#pages .page.next')

        d.set_window_size(800, 600)
        self.assertTrue(current_page.is_displayed())
        self.assertFalse(next_page.is_displayed(), 'Next page should be hidden on narrow screens')

        d.set_window_size(1280, 400)
        self.assertTrue(current_page.is_displayed())
        self.assertTrue(next_page.is_displayed(), 'Next page should be visible on wide screens')


if __name__ == "__main__":
    unittest.main()
